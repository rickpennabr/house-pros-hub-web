import { listPublishedSuppliers } from '@/lib/data/suppliers-server';
import SuppliersList from './SuppliersList';

export default async function ProSuppliersPage() {
  const suppliers = await listPublishedSuppliers();

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <SuppliersList initialSuppliers={suppliers} />
    </div>
  );
}
