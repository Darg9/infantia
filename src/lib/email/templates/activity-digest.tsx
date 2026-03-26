import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from '@react-email/components';
import { activityPath } from '@/lib/activity-url';

interface ActivityDigestEmailProps {
  userName?: string;
  activities: Array<{
    id: string;
    title: string;
    description?: string;
    price?: number | null;
    priceLabel: string;
    minAge?: number | null;
    maxAge?: number | null;
  }>;
  period: 'daily' | 'weekly';
}

export const ActivityDigestEmail = ({
  userName = 'amigo',
  activities,
  period = 'daily',
}: ActivityDigestEmailProps) => {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://infantia-activities.vercel.app';
  const periodLabel = period === 'daily' ? 'hoy' : 'esta semana';

  return (
    <Html>
      <Head />
      <Preview>
        {String(activities.length)} nuevas actividades en Infantia {periodLabel}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={box}>
            <Row>
              <Text style={heading}>
                Nuevas actividades {periodLabel} 🎪
              </Text>
            </Row>
            <Hr style={hr} />
            <Text style={paragraph}>Hola {userName},</Text>
            <Text style={paragraph}>
              Encontramos {activities.length} nuevas actividades y eventos para tu familia:
            </Text>

            {activities.map((activity, index) => (
              <Section key={activity.id} style={activityCard}>
                <Text style={activityTitle}>{activity.title}</Text>
                {activity.description && (
                  <Text style={activityDescription}>
                    {activity.description.substring(0, 120)}
                    {activity.description.length > 120 ? '...' : ''}
                  </Text>
                )}
                <Row>
                  {(activity.minAge !== null || activity.maxAge !== null) && (
                    <Text style={activityMeta}>
                      👧 Edades:{' '}
                      {activity.minAge ?? '0'} - {activity.maxAge ?? '18'} años
                    </Text>
                  )}
                </Row>
                <Row>
                  <Text style={activityMeta}>💰 {activity.priceLabel}</Text>
                </Row>
                <Row style={ctaRow}>
                  <Link
                    href={`${baseUrl}${activityPath(activity.id, activity.title)}`}
                    style={smallButton}
                  >
                    Ver detalles
                  </Link>
                </Row>
                {index < activities.length - 1 && <Hr style={activityHr} />}
              </Section>
            ))}

            <Row style={ctaRow}>
              <Link href={`${baseUrl}/actividades`} style={button}>
                Ver todas las actividades
              </Link>
            </Row>

            <Hr style={hr} />

            <Text style={footerText}>
              ¿No quieres recibir estos emails?{' '}
              <Link href={`${baseUrl}/perfil/notificaciones`} style={link}>
                Ajusta tus preferencias
              </Link>
              .
            </Text>
            <Text style={footer}>© 2026 Infantia. Todos los derechos reservados.</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

const main = {
  backgroundColor: '#f3f4f6',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '20px 0 48px',
  marginBottom: '64px',
};

const box = {
  padding: '0 48px',
};

const heading = {
  fontSize: '32px',
  fontWeight: 'bold',
  margin: '16px 0',
  padding: '0',
  color: '#000',
};

const hr = {
  borderColor: '#e5e7eb',
  margin: '26px 0 26px 0',
};

const paragraph = {
  color: '#525252',
  fontSize: '16px',
  lineHeight: '26px',
  margin: '16px 0',
};

const activityCard = {
  backgroundColor: '#faf8f3',
  border: '1px solid #ede9dd',
  borderRadius: '8px',
  padding: '16px',
  marginBottom: '16px',
};

const activityTitle = {
  color: '#000',
  fontSize: '18px',
  fontWeight: 'bold',
  margin: '0 0 8px 0',
};

const activityDescription = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '8px 0',
};

const activityMeta = {
  color: '#525252',
  fontSize: '13px',
  lineHeight: '18px',
  margin: '4px 0',
};

const activityHr = {
  borderColor: '#e5e7eb',
  margin: '12px 0',
};

const ctaRow = {
  textAlign: 'center' as const,
  marginTop: '16px',
  marginBottom: '16px',
};

const button = {
  backgroundColor: '#fb923c',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '12px 20px',
};

const smallButton = {
  backgroundColor: '#fb923c',
  borderRadius: '4px',
  color: '#fff',
  fontSize: '14px',
  fontWeight: '600',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
  padding: '8px 16px',
};

const link = {
  color: '#fb923c',
  textDecoration: 'underline',
};

const footerText = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '12px 0',
};

const footer = {
  color: '#9ca3af',
  fontSize: '12px',
  lineHeight: '16px',
  margin: '16px 0 0 0',
};
