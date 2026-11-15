import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  actualVehicleCost,
  categoryUsesVehicle,
  isVehicleCostCategory,
  parseTripWrite,
  parseVehicleWrite,
  tripAmountCents,
  tripRateError,
  vehicleCost,
  yearlyDraftFromExpenses,
} from './mileage-cost';

const TRUCK = {
  mpg: 18,
  fuelPriceCents: 360,
  annualMiles: 15_000,
  averageTripMiles: 24,
  insuranceCents: 180_000,
  maintenanceCents: 0,
  registrationCents: 0,
  tiresCents: 0,
  depreciationCents: 0,
  otherCents: 0,
};

describe('vehicleCost', () => {
  it('splits gas and yearly costs across the miles, then prices an average trip', () => {
    const cost = vehicleCost(TRUCK);

    assert.equal(cost.ready, true);
    assert.equal(cost.fuelPerMileCents, 20);
    assert.equal(cost.fixedPerMileCents, 12);
    assert.equal(cost.costPerMileCents, 32);
    assert.equal(Math.round((cost.gallonsPerTrip ?? 0) * 1000) / 1000, 1.333);
    assert.equal(Math.round(cost.fuelPerTripCents ?? 0), 480);
    assert.equal(cost.fixedPerTripCents, 288);
    assert.equal(cost.averageTripCents, 768);
    assert.equal(tripAmountCents(40, cost.costPerMileCents ?? 0), 1280);
  });

  it('prices fuel alone when the yearly costs are zero', () => {
    const cost = vehicleCost({
      ...TRUCK,
      insuranceCents: 0,
      annualMiles: null,
      averageTripMiles: null,
    });

    assert.equal(cost.ready, true);
    assert.equal(cost.fixedPerMileCents, 0);
    assert.equal(cost.costPerMileCents, 20);
    assert.equal(cost.averageTripCents, null);
    assert.equal(tripRateError(cost), null);
  });

  it('refuses a rate until gas and the yearly-mile split are both known', () => {
    const missingGas = vehicleCost({ ...TRUCK, mpg: null, fuelPriceCents: null });
    assert.equal(missingGas.ready, false);
    assert.match(tripRateError(missingGas) ?? '', /gas price/);

    const missingMiles = vehicleCost({ ...TRUCK, annualMiles: null });
    assert.equal(missingMiles.ready, false);
    assert.equal(missingMiles.missing.includes('annualMiles'), true);
  });

  it('keeps a zero gas price as a real input', () => {
    const cost = vehicleCost({ ...TRUCK, fuelPriceCents: 0 });
    assert.equal(cost.fuelPerMileCents, 0);
    assert.equal(cost.costPerMileCents, 12);
  });
});

describe('actualVehicleCost', () => {
  it('uses logged miles, and does not count a posted mileage expense twice', () => {
    const actual = actualVehicleCost(
      TRUCK,
      [
        { category: 'Fuel', amountCents: 40_000 },
        { category: 'Insurance', amountCents: 180_000 },
        { category: 'Mileage', amountCents: 12_800 },
        { category: 'Materials', amountCents: 9_000 },
      ],
      1_000
    );

    assert.equal(isVehicleCostCategory('Mileage'), false);
    assert.equal(actual.expenseCents, 220_000);
    assert.equal(actual.milesSource, 'trips');
    assert.equal(actual.costPerMileCents, 220);
    assert.equal(actual.averageTripCents, 5280);
    assert.equal(actual.byCategory.fuel, 40_000);
    assert.equal(actual.byCategory.insurance, 180_000);
  });

  it('falls back to the yearly miles when no trips are logged yet', () => {
    const actual = actualVehicleCost(TRUCK, [{ category: 'Insurance', amountCents: 180_000 }], 0);
    assert.equal(actual.milesSource, 'yearly');
    assert.equal(actual.miles, 15_000);
    assert.equal(actual.costPerMileCents, 12);
  });
});

describe('yearlyDraftFromExpenses', () => {
  it('maps tagged expenses onto the yearly fields and leaves gas alone', () => {
    const draft = yearlyDraftFromExpenses({
      insurance: 180_000,
      repairs: 20_000,
      maintenance: 5_000,
      vehicle: 8_000,
      fuel: 40_000,
    });
    assert.equal(draft.insuranceCents, 180_000);
    assert.equal(draft.maintenanceCents, 25_000);
    assert.equal(draft.otherCents, 8_000);
    assert.equal('fuelCents' in draft, false);
  });
});

describe('parseVehicleWrite', () => {
  it('accepts a truck and rejects a blank name', () => {
    const parsed = parseVehicleWrite({ name: ' Work truck ', mpg: 18, fuelPriceCents: 360, annualMiles: 15000, averageTripMiles: 24, insuranceCents: 180000 });
    assert.equal(parsed.ok, true);
    if (parsed.ok) assert.equal(parsed.value.name, 'Work truck');
    assert.equal(parseVehicleWrite({ name: '  ' }).ok, false);
  });
});

describe('parseTripWrite', () => {
  it('keeps one decimal of miles and requires a vehicle', () => {
    const parsed = parseTripWrite({
      vehicleId: '11111111-1111-4111-8111-111111111111',
      tripDate: '2026-11-14',
      purpose: 'job',
      miles: 24.26,
      origin: ' Shop ',
      destination: '',
    });
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.equal(parsed.value.miles, 24.3);
      assert.equal(parsed.value.origin, 'Shop');
      assert.equal(parsed.value.destination, null);
      assert.equal(parsed.value.customerId, null);
      assert.equal(parsed.value.estimateId, null);
    }
    const linked = parseTripWrite({
      vehicleId: '11111111-1111-4111-8111-111111111111',
      customerId: '22222222-2222-4222-8222-222222222222',
      estimateId: '33333333-3333-4333-8333-333333333333',
      tripDate: '2026-11-14',
      purpose: 'estimate',
      miles: 12,
    });
    assert.equal(linked.ok, true);
    if (linked.ok) {
      assert.equal(linked.value.customerId, '22222222-2222-4222-8222-222222222222');
      assert.equal(linked.value.estimateId, '33333333-3333-4333-8333-333333333333');
    }
    assert.equal(parseTripWrite({
      vehicleId: '11111111-1111-4111-8111-111111111111',
      customerId: 'not-an-id',
      tripDate: '2026-11-14',
      purpose: 'job',
      miles: 10,
    }).ok, false);
    assert.equal(parseTripWrite({ tripDate: '2026-11-14', purpose: 'job', miles: 10 }).ok, false);
  });
});

describe('categoryUsesVehicle', () => {
  it('tags fuel and posted mileage, not materials', () => {
    assert.equal(categoryUsesVehicle('Fuel'), true);
    assert.equal(categoryUsesVehicle('Mileage'), true);
    assert.equal(categoryUsesVehicle('Materials'), false);
  });
});
