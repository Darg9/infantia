import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import { DATA_TREATMENT_SECTIONS, DATA_TREATMENT_META } from '@/modules/legal/constants/data-treatment';

// =============================================================================
// DataTreatmentPDF — Documento PDF de Política de Tratamiento de Datos
// Generado server-side via /api/legal/datos/pdf
// =============================================================================

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    paddingTop: 50,
    paddingBottom: 60,
    paddingHorizontal: 50,
    color: '#1a1a1a',
    backgroundColor: '#ffffff',
  },
  // ── Header ──────────────────────────────────────────────────
  headerBrand: {
    fontSize: 16,
    fontFamily: 'Helvetica-Bold',
    color: '#f97316',
    marginBottom: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginBottom: 6,
  },
  headerDate: {
    fontSize: 9,
    color: '#6b7280',
    marginBottom: 28,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginBottom: 20,
  },
  // ── Secciones ────────────────────────────────────────────────
  sectionNumber: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: '#111827',
    marginBottom: 6,
    marginTop: 16,
  },
  sectionText: {
    fontSize: 10,
    color: '#374151',
    lineHeight: 1.6,
    marginBottom: 4,
  },
  bulletItem: {
    fontSize: 10,
    color: '#374151',
    lineHeight: 1.6,
    marginLeft: 12,
    marginBottom: 3,
  },
  // ── Footer ───────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 50,
    right: 50,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 8,
    color: '#9ca3af',
  },
});

export function DataTreatmentPDF() {
  return (
    <Document
      title={`${DATA_TREATMENT_META.title} — ${DATA_TREATMENT_META.brand}`}
      author={DATA_TREATMENT_META.brand}
      subject={`${DATA_TREATMENT_META.title} conforme a ${DATA_TREATMENT_META.applicableLaw} (${DATA_TREATMENT_META.version})`}
    >
      <Page size="A4" style={styles.page}>

        {/* ── Header ─────────────────────────────────────────── */}
        <Text style={styles.headerBrand}>{DATA_TREATMENT_META.brand}</Text>
        <Text style={styles.headerTitle}>{DATA_TREATMENT_META.title}</Text>
        <Text style={styles.headerDate}>
          Última actualización: {DATA_TREATMENT_META.lastUpdated} · {DATA_TREATMENT_META.applicableLaw} · Versión: {DATA_TREATMENT_META.version}
        </Text>
        <View style={styles.divider} />

        {/* ── Secciones ──────────────────────────────────────── */}
        {DATA_TREATMENT_SECTIONS.map(({ num, title, content }) => (
          <View key={num} wrap={false}>
            <Text style={styles.sectionNumber}>{num} {title}</Text>
            {content.map((item, i) => {
              const c = item as { type: string; text: string };
              return c.type === 'bullet' ? (
                <Text key={i} style={styles.bulletItem}>• {c.text}</Text>
              ) : (
                <Text key={i} style={styles.sectionText}>{c.text}</Text>
              );
            })}
          </View>
        ))}

        {/* ── Footer ─────────────────────────────────────────── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            © {new Date().getFullYear()} {DATA_TREATMENT_META.brand} · Bogotá, Colombia
          </Text>
          <Text style={styles.footerText}>
            Versión: {DATA_TREATMENT_META.version} — Última actualización: {DATA_TREATMENT_META.lastUpdated}
          </Text>
        </View>

      </Page>
    </Document>
  );
}
