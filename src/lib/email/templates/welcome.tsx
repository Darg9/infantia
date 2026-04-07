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

interface WelcomeEmailProps {
  userEmail?: string;
}

export const WelcomeEmail = ({ userEmail = 'friend' }: WelcomeEmailProps) => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://habitaplan.com';

  return (
    <Html>
      <Head />
      <Preview>Bienvenido a HabitaPlan — descubre actividades para tu familia</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={box}>
            <Row>
              <Text style={heading}>Bienvenido a HabitaPlan 🎉</Text>
            </Row>
            <Hr style={hr} />
            <Text style={paragraph}>
              Hola {userEmail},
            </Text>
            <Text style={paragraph}>
              Nos alegra mucho que te hayas unido a HabitaPlan. A partir de ahora podrás:
            </Text>
            <Text style={bulletPoint}>
              ✓ Descubrir actividades, eventos y talleres para tus hijos en Bogotá
            </Text>
            <Text style={bulletPoint}>
              ✓ Guardar tus favoritos para acceder rápidamente
            </Text>
            <Text style={bulletPoint}>
              ✓ Crear perfiles de tus hijos y recibir recomendaciones personalizadas
            </Text>
            <Text style={bulletPoint}>
              ✓ Calificar actividades y compartir tu opinión con otros padres
            </Text>

            <Row style={cta}>
              <Link href={`${baseUrl}/actividades`} style={button}>
                Explorar Actividades
              </Link>
            </Row>

            <Hr style={hr} />

            <Text style={footerText}>
              Puedes personalizar tus preferencias de notificación en tu{' '}
              <Link href={`${baseUrl}/perfil/notificaciones`} style={link}>
                perfil
              </Link>
              .
            </Text>
            <Text style={footerText}>
              ¿Preguntas? Contáctanos en{' '}
              <Link href={`${baseUrl}/contacto`} style={link}>
                habitaplan.com/contacto
              </Link>
            </Text>
            <Text style={footer}>© 2026 HabitaPlan. Todos los derechos reservados.</Text>
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

const bulletPoint = {
  color: '#525252',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '8px 0',
  paddingLeft: '8px',
};

const cta = {
  textAlign: 'center' as const,
  marginTop: '32px',
  marginBottom: '32px',
};

const button = {
  backgroundColor: '#fb923c',
  borderRadius: '3px',
  color: '#fff',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'block',
  padding: '12px 20px',
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
