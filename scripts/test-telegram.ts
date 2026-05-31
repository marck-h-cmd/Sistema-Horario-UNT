import fs from 'fs';
import path from 'path';

function loadEnvFile(filePath: string) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8');
    content.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.substring(0, idx).trim();
        let val = trimmed.substring(idx + 1).trim();
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.substring(1, val.length - 1);
        }
        process.env[key] = val;
      }
    });
  }
}

// Cargar .env primero, luego .env.local para que sobrescriba
loadEnvFile(path.resolve(process.cwd(), '.env'));
loadEnvFile(path.resolve(process.cwd(), '.env.local'));

// Override Redis port to host-mapped port 6380
process.env.REDIS_URL = 'redis://:unt_redis_secret@localhost:6380';

import { PrismaClient } from '@prisma/client';
import axios from 'axios';

async function main() {
  console.log('🤖 Iniciando script de prueba del Bot de Telegram...');

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const username = process.env.TELEGRAM_BOT_USERNAME;
  const targetChatId = '8777723082';

  if (!token) {
    console.error('❌ Error: TELEGRAM_BOT_TOKEN no está definido en .env.local');
    process.exit(1);
  }

  console.log(`🔑 Token del Bot: ${token.substring(0, 10)}... (longitud: ${token.length})`);
  console.log(`🤖 Username del Bot configurado: @${username || 'no definido'}`);
  console.log(`🎯 Chat ID de destino: ${targetChatId}`);

  // 1. Verificar conectividad del bot (getMe)
  console.log('\n🔍 1. Verificando conectividad del bot con la API de Telegram...');
  try {
    const res = await axios.get(`https://api.telegram.org/bot${token}/getMe`);
    if (res.data && res.data.ok) {
      const botInfo = res.data.result;
      console.log('✅ Conexión con Telegram exitosa!');
      console.log(`   - ID del Bot: ${botInfo.id}`);
      console.log(`   - Nombre: ${botInfo.first_name}`);
      console.log(`   - Username del Bot real: @${botInfo.username}`);
    } else {
      console.error('❌ Error al obtener info del bot:', res.data);
    }
  } catch (error: any) {
    console.error('❌ Error conectando con Telegram API:', error.message);
    if (error.response) {
      console.error('   Detalles:', error.response.data);
    }
    process.exit(1);
  }

  // 2. Enviar mensaje de prueba directo con Axios
  console.log('\n⚡ 2. Enviando mensaje de prueba directo con Axios...');
  try {
    const text = `<b>🤖 MENSAJE DE PRUEBA</b>\n\nEste es un mensaje de prueba enviado directamente desde el script de verificación para probar el envío al Chat ID: <code>${targetChatId}</code>.\n\n🏫 <b>Escuela de Ingeniería de Sistemas - UNT</b>\n📅 ${new Date().toLocaleString()}`;
    const res = await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
      chat_id: targetChatId,
      text: text,
      parse_mode: 'HTML',
    });

    if (res.data && res.data.ok) {
      console.log('✅ Mensaje directo enviado con éxito!');
      console.log('   Detalles de la respuesta de Telegram:', JSON.stringify(res.data.result, null, 2));
    } else {
      console.error('❌ Telegram no retornó ok:', res.data);
    }
  } catch (error: any) {
    console.error('❌ Error al enviar mensaje directo:', error.message);
    if (error.response) {
      console.error('   Detalles de Telegram:', error.response.data);
    }
  }

  // 3. Probar pipeline de ServicioTelegram del proyecto
  console.log('\n🔄 3. Probando a través de la tubería oficial (ServicioTelegram)...');
  const prisma = new PrismaClient();

  try {
    // Buscar o crear un usuario/docente de prueba temporal
    const emailPrueba = 'test-telegram-marck@unitru.edu.pe';
    
    let usuario = await prisma.usuario.findFirst({
      where: { email: emailPrueba },
    });

    if (!usuario) {
      console.log(`   👤 Creando usuario temporal: ${emailPrueba}`);
      usuario = await prisma.usuario.create({
        data: {
          email: emailPrueba,
          password: 'password_seguro_123',
          nombre: 'Docente',
          apellidos: 'Prueba Telegram',
          rol: 'DOCENTE',
          verificado: true,
        },
      });
    }

    let docente = await prisma.docente.findUnique({
      where: { usuarioId: usuario.id },
    });

    if (!docente) {
      console.log('   👨‍🏫 Creando docente temporal con Telegram ID y verificado...');
      docente = await prisma.docente.create({
        data: {
          usuarioId: usuario.id,
          codigo: 'TELE-TEST',
          categoria: 'PRINCIPAL',
          dedicacion: 'TIEMPO_COMPLETO_40H',
          departamento: 'Sistemas',
          telefono: '999999999',
          whatsapp: '999999999',
          telegramId: targetChatId,
          verificadoTelegram: true,
          preferenciasNotificacion: {
            create: {
              correoActivo: false,
              whatsappActivo: false,
              telegramActivo: true,
              sistemaActivo: true,
            },
          },
        },
      });
    } else {
      console.log('   👨‍🏫 Docente temporal existente. Actualizando Telegram ID...');
      docente = await prisma.docente.update({
        where: { id: docente.id },
        data: {
          telegramId: targetChatId,
          verificadoTelegram: true,
        },
      });
      
      await prisma.preferenciasNotificacion.upsert({
        where: { docenteId: docente.id },
        update: { telegramActivo: true },
        create: {
          docenteId: docente.id,
          correoActivo: false,
          whatsappActivo: false,
          telegramActivo: true,
          sistemaActivo: true,
        },
      });
    }

    // Instanciar y enviar usando el servicio oficial
    const { ServicioTelegram } = await import('@/services/notificaciones/ServicioTelegram');
    const servicioTelegram = new ServicioTelegram();

    console.log('   🚀 Enviando notificación oficial a través de ServicioTelegram...');
    const exito = await servicioTelegram.enviar({
      usuarioId: usuario.id,
      tipo: 'RECORDATORIO',
      titulo: 'Recordatorio: Registrar Disponibilidad',
      mensaje: 'Estimado docente, este es un mensaje automático del sistema oficial de horarios. Recuerde registrar su disponibilidad horaria en el portal.',
      prioridad: 'ALTA',
      canal: 'TELEGRAM',
      metadata: {
        detalle: 'Vence el 31 de Mayo',
        enlace: 'http://localhost:3000/dashboard/docente',
      },
    });

    if (exito) {
      console.log('   ✅ Notificación oficial enviada y registrada correctamente!');
    } else {
      console.error('   ❌ Error: El ServicioTelegram reportó falla en el envío.');
    }

    // Limpieza de docente/usuario temporal
    console.log('\n🧹 4. Realizando limpieza de datos de prueba...');
    await prisma.preferenciasNotificacion.deleteMany({
      where: { docenteId: docente.id },
    });
    await prisma.docente.delete({
      where: { id: docente.id },
    });
    await prisma.usuario.delete({
      where: { id: usuario.id },
    });
    console.log('   ✅ Limpieza completada con éxito.');

  } catch (error: any) {
    console.error('❌ Error en el pipeline oficial:', error);
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n🏁 Script de prueba finalizado.');
}

main().catch(console.error);
