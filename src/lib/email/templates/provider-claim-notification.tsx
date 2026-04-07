// =============================================================================
// provider-claim-notification.tsx — Email al admin cuando un provider reclama perfil
// =============================================================================

import {
  Body, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text,
} from '@react-email/components';

interface Props {
  claimantName:  string;
  claimantEmail: string;
  providerName:  string;
  providerSlug:  string;
  message?:      string;
  claimId:       string;
}

const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://habitaplan-activities.vercel.app';

export function ProviderClaimNotificationEmail({
  claimantName,
  claimantEmail,
  providerName,
  providerSlug,
  message,
  claimId,
}: Props) {
  return (
    <Html>
      <Head />
      <Preview>Nueva solicitud de reclamación — {providerName}</Preview>
      <Body style={{ backgroundColor: '#f9fafb', fontFamily: 'sans-serif' }}>
        <Container style={{ maxWidth: 560, margin: '40px auto', backgroundColor: '#ffffff', borderRadius: 16, padding: '32px 40px', border: '1px solid #e5e7eb' }}>
          <Heading style={{ fontSize: 20, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
            📋 Nueva solicitud de reclamación
          </Heading>
          <Text style={{ color: '#6b7280', fontSize: 14, marginTop: 0 }}>
            Alguien quiere reclamar el perfil de <strong>{providerName}</strong>.
          </Text>

          <Hr style={{ borderColor: '#e5e7eb', margin: '20px 0' }} />

          <Section>
            <Text style={{ fontSize: 14, color: '#374151', margin: '4px 0' }}>
              <strong>Solicitante:</strong> {claimantName}
            </Text>
            <Text style={{ fontSize: 14, color: '#374151', margin: '4px 0' }}>
              <strong>Email:</strong> {claimantEmail}
            </Text>
            <Text style={{ fontSize: 14, color: '#374151', margin: '4px 0' }}>
              <strong>Proveedor:</strong> {providerName}
            </Text>
            {message && (
              <Text style={{ fontSize: 14, color: '#374151', margin: '12px 0 4px' }}>
                <strong>Mensaje:</strong><br />
                {message}
              </Text>
            )}
          </Section>

          <Hr style={{ borderColor: '#e5e7eb', margin: '20px 0' }} />

          <Link
            href={`${baseUrl}/admin/claims`}
            style={{ display: 'inline-block', backgroundColor: '#f97316', color: '#ffffff', borderRadius: 10, padding: '10px 24px', fontSize: 14, fontWeight: 600, textDecoration: 'none' }}
          >
            Revisar solicitud →
          </Link>

          <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 24 }}>
            ID de solicitud: {claimId} · Perfil: {baseUrl}/proveedores/{providerSlug}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
