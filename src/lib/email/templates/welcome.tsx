import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

interface WelcomeEmailProps {
  userEmail?: string;
}

export const WelcomeEmail = ({ userEmail }: WelcomeEmailProps) => {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://habitaplan.com';
  const greeting = userEmail ? `Hola, ${userEmail}` : 'Hola';

  return (
    <Html>
      <Head />
      <Preview>Bienvenido a HabitaPlan — encuentra planes para niños y familias en tu ciudad</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={box}>

            {/* Logo */}
            <Img
              src={`${baseUrl}/logo.png`}
              alt="HabitaPlan"
              width="160"
              style={logo}
            />

            {/* Contenido */}
            <Text style={heading}>{greeting}</Text>
            <Text style={paragraph}>
              Tu cuenta en HabitaPlan ya está activa. A partir de ahora puedes:
            </Text>
            <Text style={bulletPoint}>✓ Descubrir actividades, eventos y talleres en tu ciudad</Text>
            <Text style={bulletPoint}>✓ Guardar tus planes favoritos para acceder rápidamente</Text>
            <Text style={bulletPoint}>✓ Calificar actividades y compartir tu opinión</Text>

            <Link href={`${baseUrl}/actividades`} style={button}>
              Explorar actividades
            </Link>

            {/* Aviso */}
            <Text style={notice}>
              Si no solicitaste este correo, puedes ignorarlo. Nadie más puede acceder a tu cuenta de HabitaPlan.
              <br/>Este es un mensaje automático, por favor no respondas.
            </Text>

            <Hr style={hr} />

            {/* Firma */}
            <Text style={footer}>
              <strong style={{ color: '#475569' }}>HabitaPlan</strong>
              <br />
              Encuentra qué hacer en tu ciudad
              <br />
              <Link href={baseUrl} style={footerLink}>www.habitaplan.com</Link>
              {' · '}
              <Link href="mailto:info@habitaplan.com" style={footerLink}>info@habitaplan.com</Link>
            </Text>

          </Section>
        </Container>
      </Body>
    </Html>
  );
};

const main = {
  backgroundColor: '#f8fafc',
  fontFamily: 'Inter, Arial, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  maxWidth: '520px',
  padding: '32px 24px 24px',
};

const box = {
  padding: '0',
};

const logo = {
  marginBottom: '32px',
  display: 'block',
};

const heading = {
  color: '#002147',
  fontSize: '20px',
  fontWeight: 'bold',
  margin: '0 0 12px',
  padding: '0',
};

const paragraph = {
  color: '#475569',
  fontSize: '15px',
  lineHeight: '1.6',
  margin: '0 0 16px',
};

const bulletPoint = {
  color: '#475569',
  fontSize: '15px',
  lineHeight: '1.6',
  margin: '4px 0',
};

const button = {
  backgroundColor: '#002147',
  borderRadius: '10px',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600',
  textDecoration: 'none',
  display: 'inline-block',
  padding: '12px 28px',
  margin: '24px 0 0',
};

const notice = {
  color: '#94a3b8',
  fontSize: '12px',
  lineHeight: '1.6',
  margin: '32px 0 0',
};

const hr = {
  borderColor: '#e2e8f0',
  margin: '24px 0',
};

const footer = {
  color: '#94a3b8',
  fontSize: '12px',
  lineHeight: '1.6',
  margin: '0',
};

const footerLink = {
  color: '#002147',
  textDecoration: 'none',
};
