import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import { formatDurationClock } from '@/lib/crm/maintenance-defaults';

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: 'Helvetica' },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 4, textTransform: 'uppercase' },
  businessName: { fontWeight: 'bold', marginBottom: 2 },
  muted: { fontSize: 9, color: '#374151', marginBottom: 2 },
  section: { marginTop: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', marginBottom: 6, textTransform: 'uppercase' },
  row: { flexDirection: 'row', marginBottom: 4 },
  label: { width: 110, fontSize: 9, color: '#6b7280' },
  value: { flex: 1, fontSize: 10 },
  chip: {
    borderWidth: 1,
    borderColor: '#111',
    borderRadius: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginRight: 6,
    marginBottom: 6,
  },
  chipText: { fontSize: 9 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  body: { fontSize: 10, lineHeight: 1.4, color: '#111' },
  notes: { fontSize: 10, lineHeight: 1.4, color: '#374151', marginTop: 4 },
});

export type MaintenanceReportPdfProps = {
  businessName: string;
  businessAddress?: string | null;
  businessPhone?: string | null;
  businessEmail?: string | null;
  customerName: string;
  customerAddress?: string | null;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  services: Array<{ name: string; description: string }>;
  generatedDescription: string | null;
  notes: string | null;
  responsibleName: string | null;
  mediaCounts: { beforePhotos: number; beforeVideos: number; afterPhotos: number; afterVideos: number };
};

function formatWhen(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MaintenanceReportPdfDocument(props: MaintenanceReportPdfProps) {
  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <Text style={styles.title}>Maintenance Report</Text>
        <Text style={styles.businessName}>{props.businessName}</Text>
        {props.businessAddress ? <Text style={styles.muted}>{props.businessAddress}</Text> : null}
        {props.businessPhone ? <Text style={styles.muted}>{props.businessPhone}</Text> : null}
        {props.businessEmail ? <Text style={styles.muted}>{props.businessEmail}</Text> : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Property</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Customer</Text>
            <Text style={styles.value}>{props.customerName}</Text>
          </View>
          {props.customerAddress ? (
            <View style={styles.row}>
              <Text style={styles.label}>Address</Text>
              <Text style={styles.value}>{props.customerAddress}</Text>
            </View>
          ) : null}
          <View style={styles.row}>
            <Text style={styles.label}>Started</Text>
            <Text style={styles.value}>{formatWhen(props.startedAt)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Finished</Text>
            <Text style={styles.value}>{formatWhen(props.endedAt)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Duration</Text>
            <Text style={styles.value}>
              {props.durationSeconds != null ? formatDurationClock(props.durationSeconds) : '—'}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Responsible</Text>
            <Text style={styles.value}>{props.responsibleName ?? '—'}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Services completed</Text>
          <View style={styles.chips}>
            {props.services.map((service) => (
              <View key={service.name} style={styles.chip}>
                <Text style={styles.chipText}>{service.name}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Visit summary</Text>
          <Text style={styles.body}>{props.generatedDescription || 'No summary generated.'}</Text>
        </View>

        {props.notes?.trim() ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Notes / out of scope</Text>
            <Text style={styles.notes}>{props.notes}</Text>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Media package</Text>
          <Text style={styles.muted}>
            Before: {props.mediaCounts.beforePhotos} photo(s), {props.mediaCounts.beforeVideos} video(s)
          </Text>
          <Text style={styles.muted}>
            After: {props.mediaCounts.afterPhotos} photo(s), {props.mediaCounts.afterVideos} video(s)
          </Text>
        </View>
      </Page>
    </Document>
  );
}
