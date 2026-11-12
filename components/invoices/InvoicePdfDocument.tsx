import React from 'react';
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import type { InvoiceTemplateInvoice, InvoiceTemplateCustomer, InvoiceTemplateBusiness } from './InvoiceTemplate';
import { formatInvoiceDueDisplay } from '@/lib/invoices/invoiceDueOnReceipt';
import { contactDisplayName } from '@/lib/crm/contact-name';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10 },
  header: { flexDirection: 'row', marginBottom: 24, paddingBottom: 16, borderBottomWidth: 2 },
  headerLeft: { flex: 1 },
  headerCenter: { flex: 1, justifyContent: 'center' },
  headerRight: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 4, textTransform: 'uppercase' },
  businessName: { fontWeight: 'bold', marginBottom: 4 },
  address: { fontSize: 9, color: '#374151', marginTop: 2 },
  contact: { fontSize: 9, color: '#374151', marginTop: 2 },
  logo: { width: 48, height: 48, borderRadius: 24, marginRight: 12 },
  tagline: { fontSize: 9, fontStyle: 'italic', marginTop: 2 },
  tintBlock: { padding: 16, marginBottom: 24, borderRadius: 4 },
  tintRow: { flexDirection: 'row', marginBottom: 8 },
  billToLabel: { fontSize: 8, fontWeight: 'bold', marginBottom: 4, color: '#6b7280' },
  billToName: { fontWeight: 'bold', marginBottom: 4 },
  metaGrid: { flexDirection: 'row', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#d1d5db' },
  metaCol: { flex: 1 },
  metaLabel: { fontSize: 8, color: '#6b7280', marginBottom: 2 },
  metaValue: { fontSize: 10 },
  table: { marginBottom: 24 },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 2, borderColor: '#000', paddingVertical: 8 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#e5e7eb', paddingVertical: 6 },
  colNum: { width: 24, paddingRight: 8 },
  colProduct: { flex: 2, paddingRight: 8 },
  colDesc: { flex: 2, paddingRight: 8 },
  colUnit: { width: 32, paddingRight: 8 },
  colQty: { width: 36, textAlign: 'right', paddingRight: 8 },
  colRate: { width: 56, textAlign: 'right', paddingRight: 8 },
  colAmount: { width: 56, textAlign: 'right' },
  tableHeaderText: { fontSize: 8, fontWeight: 'bold', color: '#6b7280', textTransform: 'uppercase' },
  totals: { width: 200, marginLeft: 'auto', marginBottom: 16 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  totalLabel: { fontWeight: 'bold' },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTopWidth: 2, borderColor: '#000', fontWeight: 'bold', fontSize: 12 },
  statusBadge: { marginTop: 8, paddingVertical: 4, paddingHorizontal: 12, borderRadius: 4, alignSelf: 'flex-start', fontWeight: 'bold', fontSize: 10 },
  noteSection: { marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  noteLabel: { fontSize: 8, fontWeight: 'bold', color: '#6b7280', marginBottom: 4, textTransform: 'uppercase' },
  noteText: { fontSize: 9, color: '#374151' },
});

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: '2-digit', day: '2-digit' });
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function getCustomerAddress(c: InvoiceTemplateCustomer): string {
  if (c.billing_address?.trim()) return c.billing_address.trim();
  const parts = [c.street_address, [c.city, c.state, c.zip_code].filter(Boolean).join(', ')].filter(Boolean);
  return parts.join('\n') || '—';
}

interface InvoicePdfDocumentProps {
  invoice: InvoiceTemplateInvoice;
  customer: InvoiceTemplateCustomer;
  business: InvoiceTemplateBusiness;
  themeColor: string;
}

export function InvoicePdfDocument({ invoice, customer, business, themeColor }: InvoicePdfDocumentProps) {
  const paymentApplied = invoice.payment_applied_cents ?? 0;
  const balanceDue = Math.max(0, invoice.amount_cents - paymentApplied);
  const lineItems = Array.isArray(invoice.line_items) ? invoice.line_items : [];
  const customerAddress = getCustomerAddress(customer);
  const tintBg = themeColor && themeColor !== '#000000' ? themeColor + '20' : '#f3f4f6';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={[styles.header, { borderBottomColor: themeColor }]}>
          <View style={styles.headerLeft}>
            <Text style={[styles.title, { color: themeColor }]}>INVOICE</Text>
            <Text style={styles.businessName}>{business.business_name}</Text>
            {business.address ? <Text style={styles.address}>{business.address}</Text> : null}
          </View>
          <View style={styles.headerCenter}>
            {business.email ? <Text style={styles.contact}>{business.email}</Text> : null}
            {business.phone ? <Text style={styles.contact}>{business.phone}</Text> : null}
            {business.website ? <Text style={styles.contact}>{business.website}</Text> : null}
          </View>
          <View style={styles.headerRight}>
            {business.business_logo ? (
              <Image src={business.business_logo} style={styles.logo} />
            ) : null}
            <View>
              <Text style={styles.businessName}>{business.business_name}</Text>
              {business.company_tagline ? (
                <Text style={[styles.tagline, { color: themeColor }]}>{business.company_tagline}</Text>
              ) : null}
            </View>
          </View>
        </View>

        <View style={[styles.tintBlock, { backgroundColor: tintBg }]}>
          <Text style={styles.billToLabel}>Bill to</Text>
          <Text style={styles.billToName}>
            {contactDisplayName(customer)}
          </Text>
          {customerAddress ? <Text style={styles.address}>{customerAddress}</Text> : null}
          <View style={styles.metaGrid}>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Invoice no.</Text>
              <Text style={styles.metaValue}>{invoice.invoice_number}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Invoice date</Text>
              <Text style={styles.metaValue}>{formatDate(invoice.invoice_date)}</Text>
            </View>
            <View style={styles.metaCol}>
              <Text style={styles.metaLabel}>Due date</Text>
              <Text style={styles.metaValue}>
                {formatInvoiceDueDisplay(
                  invoice.invoice_date,
                  invoice.due_date,
                  invoice.payment_terms,
                  formatDate
                )}
              </Text>
            </View>
            {invoice.payment_terms ? (
              <View style={styles.metaCol}>
                <Text style={styles.metaLabel}>Terms</Text>
                <Text style={styles.metaValue}>{invoice.payment_terms}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.colNum, styles.tableHeaderText]}>#</Text>
            <Text style={[styles.colProduct, styles.tableHeaderText]}>Product or service</Text>
            <Text style={[styles.colDesc, styles.tableHeaderText]}>Description</Text>
            <Text style={[styles.colUnit, styles.tableHeaderText]}>Unit</Text>
            <Text style={[styles.colQty, styles.tableHeaderText]}>Qty</Text>
            <Text style={[styles.colRate, styles.tableHeaderText]}>Rate</Text>
            <Text style={[styles.colAmount, styles.tableHeaderText]}>Amount</Text>
          </View>
          {lineItems.length === 0 ? (
            <View style={styles.tableRow}>
              <Text style={[styles.colProduct, { color: '#6b7280' }]}>No line items</Text>
            </View>
          ) : (
            lineItems.map((line, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.colNum}>{i + 1}</Text>
                <Text style={styles.colProduct}>{line.product_or_service || '—'}</Text>
                <Text style={[styles.colDesc, { color: '#6b7280' }]}>{line.description || '—'}</Text>
                <Text style={styles.colUnit}>{line.unit || '—'}</Text>
                <Text style={styles.colQty}>{line.qty}</Text>
                <Text style={styles.colRate}>{formatCurrency(line.rate_cents)}</Text>
                <Text style={styles.colAmount}>{formatCurrency(line.amount_cents)}</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total</Text>
            <Text>{formatCurrency(invoice.amount_cents)}</Text>
          </View>
          {paymentApplied > 0 && (
            <View style={[styles.totalRow, { color: '#6b7280' }]}>
              <Text>Payment</Text>
              <Text>-{formatCurrency(paymentApplied)}</Text>
            </View>
          )}
          <View style={styles.balanceRow}>
            <Text style={styles.totalLabel}>Balance due</Text>
            <Text>{formatCurrency(balanceDue)}</Text>
          </View>
          {invoice.status === 'paid' && (
            <View style={[styles.statusBadge, { backgroundColor: '#16a34a', color: '#fff' }]}>
              <Text>Paid in Full</Text>
            </View>
          )}
          {invoice.status === 'overdue' && (
            <View style={[styles.statusBadge, { backgroundColor: '#d97706', color: '#fff' }]}>
              <Text>Overdue</Text>
            </View>
          )}
          {invoice.status === 'partial' && (
            <View style={[styles.statusBadge, { backgroundColor: '#dbeafe', color: '#1e40af' }]}>
              <Text>Partial</Text>
            </View>
          )}
          {invoice.status === 'cancelled' && (
            <View style={[styles.statusBadge, { backgroundColor: '#e5e7eb', color: '#374151' }]}>
              <Text>Cancelled</Text>
            </View>
          )}
        </View>

        {invoice.note ? (
          <View style={styles.noteSection}>
            <Text style={styles.noteLabel}>Note</Text>
            <Text style={styles.noteText}>{invoice.note}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
