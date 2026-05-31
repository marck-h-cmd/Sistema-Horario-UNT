// Configurar variables de entorno antes de importar cualquier módulo del proyecto
process.env.REDIS_URL = 'redis://:unt_redis_secret@localhost:6380';

async function main() {
  console.log('📬 Iniciando script de prueba de envíos de email y plantillas...');

  const { PrismaClient, Rol } = await import('@prisma/client');
  const { ServicioCorreo } = await import('@/services/notificaciones/ServicioCorreo');
  const { GestorPlantillas } = await import('@/services/notificaciones/GestorPlantillas');

  const prisma = new PrismaClient();
  const emailDestino = 'marckgeo124@gmail.com';

  // 1. Buscar o crear el usuario de prueba
  let usuario = await prisma.usuario.findFirst({
    where: { email: emailDestino },
  });

  if (!usuario) {
    console.log(`👤 Creando usuario de prueba temporal con email: ${emailDestino}`);
    usuario = await prisma.usuario.create({
      data: {
        email: emailDestino,
        password: 'password_prueba_123',
        nombre: 'Marck',
        apellidos: 'Geovanni',
        rol: Rol.DOCENTE,
        verificado: true,
      },
    });
  } else {
    console.log(`👤 Usuario de prueba existente encontrado con ID: ${usuario.id}`);
  }

  // Asegurar que el docente y sus preferencias de notificación existan
  let docente = await prisma.docente.findUnique({
    where: { usuarioId: usuario.id },
  });

  if (!docente) {
    console.log('👨‍🏫 Creando perfil de docente temporal...');
    docente = await prisma.docente.create({
      data: {
        usuarioId: usuario.id,
        codigo: 'TEST-MARCK',
        categoria: 'PRINCIPAL',
        dedicacion: 'TIEMPO_COMPLETO_40H',
        departamento: 'Ingeniería de Sistemas',
        preferenciasNotificacion: {
          create: {
            correoActivo: true,
            whatsappActivo: false,
            telegramActivo: false,
            sistemaActivo: true,
          },
        },
      },
    });
  } else {
    console.log('👨‍🏫 Perfil de docente existente encontrado');
    // Asegurar que las preferencias de notificación tengan el correo activo
    await prisma.preferenciasNotificacion.upsert({
      where: { docenteId: docente.id },
      update: { correoActivo: true },
      create: {
        docenteId: docente.id,
        correoActivo: true,
        whatsappActivo: false,
        telegramActivo: false,
        sistemaActivo: true,
      },
    });
  }

  // 2. Inicializar y obtener plantilla
  console.log('📋 Inicializando plantillas de notificaciones...');
  const gestorPlantillas = new GestorPlantillas();
  await gestorPlantillas.inicializarPlantillasPorDefecto();

  const plantillas = await gestorPlantillas.listarPlantillas('CONFIRMACION_HORARIO', 'CORREO');
  if (plantillas.length === 0) {
    throw new Error('No se pudo encontrar o inicializar la plantilla CONFIRMACION_HORARIO para CORREO');
  }

  const plantilla = plantillas[0];
  console.log(`📝 Plantilla encontrada: "${plantilla.nombre}" (ID: ${plantilla.id})`);

  // 3. Procesar plantilla
  console.log('⚙️ Procesando plantilla con variables de prueba...');
  const mensajeProcesado = gestorPlantillas.procesarPlantilla(plantilla, {
    nombreDocente: 'Marck Geovanni',
    periodo: '2026-I',
    curso: 'Ingeniería de Software (EE-701)',
    horario: 'Lunes 14:00 - 17:00 / Martes 17:00 - 20:00',
    ambiente: 'Lab-4 / Aula-307',
  });

  console.log('------------------ CONTENIDO DEL MENSAJE ------------------');
  console.log(mensajeProcesado.trim());
  console.log('-----------------------------------------------------------');

  // 4. Instanciar servicio de correo y enviar
  console.log('⚡ Conectando al servicio de correo (SMTP)...');
  const servicioCorreo = new ServicioCorreo();

  const conexionOk = await servicioCorreo.verificarConexion();
  if (!conexionOk) {
    console.warn('⚠️ Advertencia: No se pudo verificar la conexión con el servidor SMTP. Intentando enviar de todos modos...');
  } else {
    console.log('✅ Conexión con el servidor SMTP verificada con éxito.');
  }

  console.log(`📧 Enviando correo de prueba a: ${emailDestino}...`);
  const exito = await servicioCorreo.enviar({
    usuarioId: usuario.id,
    tipo: 'CONFIRMACION_HORARIO',
    titulo: `Confirmación de Horario Oficial - Periodo 2026-I`,
    mensaje: mensajeProcesado,
    prioridad: 'ALTA',
    canal: 'CORREO',
  });

  if (exito) {
    console.log('🎉 ¡El correo ha sido enviado con éxito!');
  } else {
    console.error('❌ Error: El servicio de correo reportó una falla en el envío.');
  }

  await prisma.$disconnect();
}

main()
  .catch((error) => {
    console.error('❌ Ocurrió un error en la ejecución del script:', error);
    process.exit(1);
  });
