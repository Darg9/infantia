import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer';
import { PRIVACY_SECTIONS, PRIVACY_META } from '@/modules/legal/constants/privacy';

// =============================================================================
// PrivacidadPDF — Documento PDF de Política de Privacidad
// Generado server-side via /api/legal/privacidad/pdf
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

export function PrivacidadPDF() {
  return (
    <Document
      title={`${PRIVACY_META.title} — ${PRIVACY_META.brand}`}
      author={PRIVACY_META.brand}
      subject={`${PRIVACY_META.title} conforme a Ley 1581 de 2012 (${PRIVACY_META.version})`}
    >
      <Page size="A4" style={styles.page}>

        {/* ── Header ─────────────────────────────────────────── */}
        <Text style={styles.headerBrand}>{PRIVACY_META.brand}</Text>
        <Text style={styles.headerTitle}>{PRIVACY_META.title}</Text>
        <Text style={styles.headerDate}>
          Última actualización: {PRIVACY_META.lastUpdated} · {PRIVACY_META.applicableLaw} · Versión: {PRIVACY_META.version}
        </Text>
        <View style={styles.divider} />

        {/* ── Secciones ──────────────────────────────────────── */}
        {PRIVACY_SECTIONS.map(({ num, title, content }) => (
          <View key={num} wrap={false}>
            <Text style={styles.sectionNumber}>{num} {title}</Text>
            {content.map((item, i) =>
              item.type === 'bullet' ? (
                <Text key={i} style={styles.bulletItem}>• {item.text}</Text>
              ) : (
                <Text key={i} style={styles.sectionText}>{item.text}</Text>
              )
            )}
          </View>
        ))}

        {/* ── Footer ─────────────────────────────────────────── */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>
            © {new Date().getFullYear()} {PRIVACY_META.brand} · Bogotá, Colombia
          </Text>
          <Text style={styles.footerText}>
            Normativa: {PRIVACY_META.applicableLaw} · Versión: {PRIVACY_META.version} — Última actualización: {PRIVACY_META.lastUpdated}
          </Text>
        </View>

      </Page>
    </Document>
  );
}
