import { useEffect, useState } from 'react'

import {
  signIn,
  signUp,
  confirmSignUp,
  signOut,
  getCurrentUser,
  fetchAuthSession,
} from 'aws-amplify/auth'

import './amplify-config'
import './App.css'
import { getWorkshops } from './api/workshopsApi'
import { registerWorkshop } from './api/registrationsApi'
import AdminDashboard from './AdminDashboard'


function App() {
  const [talleres, setTalleres] = useState([  
    {
      id: '001',
      titulo: 'Introducción a AWS',
      descripcion:
        'Conoce los fundamentos de Amazon Web Services y los principales servicios de computación en la nube.',
      fecha: '20/08/2026',
      hora: '10:00 AM',
      cupos: 25,
      inscritos: 12,
      categoria: 'Cloud Computing',
      ubicacion: 'Laboratorio AWS',
    },
    {
      id: '002',
      titulo: 'Fundamentos de Docker',
      descripcion:
        'Aprende los conceptos básicos de contenedores, imágenes y ejecución de aplicaciones con Docker.',
      fecha: '22/08/2026',
      hora: '02:00 PM',
      cupos: 20,
      inscritos: 8,
      categoria: 'Contenedores',
      ubicacion: 'Laboratorio 2',
    },
    {
      id: '003',
      titulo: 'Kubernetes básico',
      descripcion:
        'Introducción a la orquestación de contenedores mediante deployments, services y pods.',
      fecha: '25/08/2026',
      hora: '09:00 AM',
      cupos: 30,
      inscritos: 21,
      categoria: 'Orquestación',
      ubicacion: 'Laboratorio 3',
    },
    {
      id: '005',
      titulo: 'Arquitectura Serverless',
      descripcion:
        'Explora el desarrollo de aplicaciones utilizando Lambda, API Gateway, DynamoDB y otros servicios AWS.',
      fecha: '28/08/2026',
      hora: '04:00 PM',
      cupos: 15,
      inscritos: 7,
      categoria: 'AWS Serverless',
      ubicacion: 'Laboratorio 5',
    },
  ])

  const [selectedWorkshop, setSelectedWorkshop] = useState(null)
  const [showLogin, setShowLogin] = useState(false)
  const [showRegister, setShowRegister] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)

  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [showAdminDashboard, setShowAdminDashboard] = useState(false)

  const [confirmationEmail, setConfirmationEmail] =
    useState('')

  const [authError, setAuthError] = useState('')
  const [authMessage, setAuthMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // ---------------------------------------------------------
  // Fase 5.5 — Recuperar sesión existente de Cognito
  // ---------------------------------------------------------
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const user = await getCurrentUser()

        const session = await fetchAuthSession()

        if (!session?.tokens?.idToken) {
          return
        }

        const groups = session.tokens.idToken.payload?.['cognito:groups'] || []


        setCurrentUser(user)
        setIsAuthenticated(true)
        setIsAdmin(
          Array.isArray(groups) && groups.includes('admin'),
        )

        console.log('Grupos Cognito:', groups)
        console.log(
          'Usuario administrador:',
          Array.isArray(groups) && groups.includes('admin'),
        )
        console.log(
          'Sesión de Cognito recuperada correctamente.',
        )
      } catch (error) {
        console.log(
          'No existe una sesión activa de Cognito.',
        )
      }
    }

    restoreSession()
  }, [])

// ---------------------------------------------------------
// Fase 5.4.5 — Prueba de integración GET /workshops
// ---------------------------------------------------------
useEffect(() => {
  if (!isAuthenticated) {
    return
  }

  const testWorkshopsApi = async () => {
    try {
      const data = await getWorkshops()

      console.log(
        'GET /workshops exitoso:',
        JSON.stringify(data, null, 2),    
      )

  const talleresAWS = data.items
    .filter((item) => item.SK === 'META')
    .map((item) => {
      const fechaInicio = new Date(item.startAt)

      return {
        id: item.id,
        titulo: item.name,
        descripcion: item.description,
        cupos: Number(item.capacity),
        inscritos: Number(item.registeredCount ?? 0),
        fecha: fechaInicio.toLocaleDateString('es-MX'),
        hora: fechaInicio.toLocaleTimeString('es-MX', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        ubicacion: item.location,
        categoria: item.category,
        estado: item.status,
        inicio: item.startAt,
        fin: item.endAt,
      }
    })

  setTalleres(talleresAWS)

    } catch (error) {
      console.error(
        'Error en GET /workshops:',
        error,
      )
    }
  }

  testWorkshopsApi()
}, [isAuthenticated])

  // ---------------------------------------------------------
  // Fase 5.5 — Cerrar sesión real de Cognito
  // ---------------------------------------------------------
  const handleLogout = async () => {
    try {
      await signOut()

      console.log(
        'Sesión de Cognito cerrada correctamente.',
      )
    } catch (error) {
      console.error(
        'Error al cerrar sesión:',
        error,
      )
    }

    setCurrentUser(null)
    setIsAuthenticated(false)
    setIsAdmin(false)
    setShowAdminDashboard(false)
    setShowLogin(false)
    setShowRegister(false)
    setShowConfirmation(false)
    setAuthError('')
    setAuthMessage('')
  }

  // ---------------------------------------------------------
  // Fase 5.5 — Login real con Cognito
  // ---------------------------------------------------------
  const handleLogin = async (event) => {
    event.preventDefault()

    setAuthError('')
    setAuthMessage('')
    setIsLoading(true)

    const formData = new FormData(event.currentTarget)

    const email = String(
      formData.get('email') || '',
    ).trim()

    const password = String(
      formData.get('password') || '',
    )

    try {
      const result = await signIn({
        username: email,
        password,
      })

      console.log(
        'Resultado de inicio de sesión:',
        result,
      )

      if (
        result?.isSignedIn ||
        result?.nextStep?.signInStep === 'DONE'
      ) {
        const user = await getCurrentUser()

        const session = await fetchAuthSession()

        const groups =
          session.tokens?.idToken?.payload?.[
            'cognito:groups'
          ] || []

        const userIsAdmin =
          Array.isArray(groups) &&
          groups.includes('admin')

        console.log(
          'Login exitoso. Token recibido correctamente.',
        )

        console.log(
          'Grupos Cognito:',
          groups,
        )

        console.log(
          'Usuario administrador:',
          userIsAdmin,
        )

        // Guardar correctamente el usuario autenticado
        setCurrentUser(user)
        setIsAuthenticated(true)
        setIsAdmin(userIsAdmin)

        // Cerrar la pantalla de login
        setShowLogin(false)
        setShowRegister(false)
        setShowConfirmation(false)

        setAuthError('')
        setAuthMessage('')

        // Finalizar estado de carga
        setIsLoading(false)

        return
      }

      setAuthMessage(
        'El inicio de sesión requiere un paso adicional.',
      )

      setIsLoading(false)
    } catch (error) {
      console.error(
        'Error de autenticación:',
        error,
      )

      setAuthError(
        error?.message ||
          'No fue posible iniciar sesión.',
      )

      setIsLoading(false)
    }
  }

  // ---------------------------------------------------------
  // Fase 5.5 — Registro real con Cognito
  // ---------------------------------------------------------
  const handleRegister = async (event) => {
    event.preventDefault()

    setAuthError('')
    setAuthMessage('')

    const formData = new FormData(event.currentTarget)

    const name = String(
      formData.get('name') || '',
    ).trim()

    const email = String(
      formData.get('email') || '',
    ).trim()

    const password = String(
      formData.get('password') || '',
    )

    const confirmPassword = String(
      formData.get('confirmPassword') || '',
    )

    if (password !== confirmPassword) {
      setAuthError(
        'Las contraseñas no coinciden.',
      )

      return
    }

    setIsLoading(true)

    try {
      const result = await signUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email,
            name,
          },
        },
      })

      console.log(
        'Usuario registrado:',
        result,
      )

      setConfirmationEmail(email)
      setShowRegister(false)
      setShowConfirmation(true)
      setAuthError('')
      setAuthMessage(
        'Cuenta creada. Revisa tu correo electrónico para obtener el código de confirmación.',
      )
    } catch (error) {
      console.error(
        'Error de registro:',
        error,
      )

      setAuthError(
        error?.message ||
          'No fue posible crear la cuenta.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  // ---------------------------------------------------------
  // Fase 5.5 — Confirmación de cuenta
  // ---------------------------------------------------------
  const handleConfirmation = async (event) => {
    event.preventDefault()

    setAuthError('')
    setAuthMessage('')
    setIsLoading(true)

    const formData = new FormData(event.currentTarget)

    const code = String(
      formData.get('code') || '',
    ).trim()

    try {
      await confirmSignUp({
        username: confirmationEmail,
        confirmationCode: code,
      })

      setShowConfirmation(false)
      setShowLogin(true)
      setAuthError('')
      setAuthMessage(
        'Cuenta confirmada correctamente. Ahora puedes iniciar sesión.',
      )
    } catch (error) {
      console.error(
        'Error de confirmación:',
        error,
      )

      setAuthError(
        error?.message ||
          'No fue posible confirmar la cuenta.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  // ---------------------------------------------------------
  // Fase 5.5 — Pantalla Login
  // ---------------------------------------------------------
  if (showLogin) {
    return (
      <div className="app">
        <header className="header">
          <div>
            <span className="eyebrow">
              AWS WORKSHOPS
            </span>

            <h1>Iniciar sesión</h1>

            <p>
              Accede a tu cuenta para gestionar tus
              inscripciones.
            </p>
          </div>

          <div className="header-badge">
            <span>●</span>
            Plataforma activa
          </div>
        </header>

        <main className="main">
          <section className="auth-container">
            <div className="auth-card">
              <div className="auth-heading">
                <span className="eyebrow">
                  ACCESO
                </span>

                <h2>Bienvenido</h2>

                <p>
                  Ingresa tus credenciales para
                  continuar.
                </p>
              </div>

              {authMessage && (
                <p className="auth-message">
                  {authMessage}
                </p>
              )}

              {authError && (
                <p className="auth-error">
                  {authError}
                </p>
              )}

              <form onSubmit={handleLogin}>
                <label htmlFor="email">
                  Correo electrónico
                </label>

                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  required
                />

                <label htmlFor="password">
                  Contraseña
                </label>

                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Ingresa tu contraseña"
                  required
                />

                <button
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading
                    ? 'Iniciando sesión...'
                    : 'Iniciar sesión'}
                </button>
              </form>

              <div className="auth-links">
                <span>
                  ¿No tienes una cuenta?
                </span>

                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setShowLogin(false)
                    setShowRegister(true)
                    setAuthError('')
                    setAuthMessage('')
                  }}
                >
                  Crear cuenta
                </button>
              </div>

              <button
                type="button"
                className="back-button auth-back"
                onClick={() => {
                  setShowLogin(false)
                  setAuthError('')
                  setAuthMessage('')
                }}
              >
                ← Volver al catálogo
              </button>
            </div>
          </section>
        </main>

        <footer>
          <span>AWS Workshops Platform</span>
          <span>Proyecto Final</span>
        </footer>
      </div>
    )
  }

  // ---------------------------------------------------------
  // Fase 5.5 — Registro
  // ---------------------------------------------------------
  if (showRegister) {
    return (
      <div className="app">
        <header className="header">
          <div>
            <span className="eyebrow">
              AWS WORKSHOPS
            </span>

            <h1>Crear cuenta</h1>

            <p>
              Regístrate para participar en nuestros
              talleres.
            </p>
          </div>

          <div className="header-badge">
            <span>●</span>
            Plataforma activa
          </div>
        </header>

        <main className="main">
          <section className="auth-container">
            <div className="auth-card">
              <div className="auth-heading">
                <span className="eyebrow">
                  REGISTRO
                </span>

                <h2>Crear una cuenta</h2>

                <p>
                  Completa los datos para crear tu
                  cuenta.
                </p>
              </div>

              {authError && (
                <p className="auth-error">
                  {authError}
                </p>
              )}

              <form onSubmit={handleRegister}>
                <label htmlFor="register-name">
                  Nombre
                </label>

                <input
                  id="register-name"
                  name="name"
                  type="text"
                  placeholder="Tu nombre"
                  required
                />

                <label htmlFor="register-email">
                  Correo electrónico
                </label>

                <input
                  id="register-email"
                  name="email"
                  type="email"
                  placeholder="correo@ejemplo.com"
                  required
                />

                <label htmlFor="register-password">
                  Contraseña
                </label>

                <input
                  id="register-password"
                  name="password"
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  minLength="8"
                  required
                />

                <label htmlFor="register-confirm">
                  Confirmar contraseña
                </label>

                <input
                  id="register-confirm"
                  name="confirmPassword"
                  type="password"
                  placeholder="Repite tu contraseña"
                  minLength="8"
                  required
                />

                <button
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading
                    ? 'Creando cuenta...'
                    : 'Crear cuenta'}
                </button>
              </form>

              <div className="auth-links">
                <span>
                  ¿Ya tienes una cuenta?
                </span>

                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setShowRegister(false)
                    setShowLogin(true)
                    setAuthError('')
                    setAuthMessage('')
                  }}
                >
                  Iniciar sesión
                </button>
              </div>

              <button
                type="button"
                className="back-button auth-back"
                onClick={() => {
                  setShowRegister(false)
                  setAuthError('')
                  setAuthMessage('')
                }}
              >
                ← Volver al catálogo
              </button>
            </div>
          </section>
        </main>

        <footer>
          <span>AWS Workshops Platform</span>
          <span>Proyecto Final</span>
        </footer>
      </div>
    )
  }

  // ---------------------------------------------------------
  // Fase 5.5 — Confirmación de cuenta
  // ---------------------------------------------------------
  if (showConfirmation) {
    return (
      <div className="app">
        <header className="header">
          <div>
            <span className="eyebrow">
              AWS WORKSHOPS
            </span>

            <h1>Confirmar cuenta</h1>

            <p>
              Verifica tu dirección de correo
              electrónico.
            </p>
          </div>

          <div className="header-badge">
            <span>●</span>
            Plataforma activa
          </div>
        </header>

        <main className="main">
          <section className="auth-container">
            <div className="auth-card">
              <div className="auth-heading">
                <span className="eyebrow">
                  CONFIRMACIÓN
                </span>

                <h2>Verifica tu correo</h2>

                <p>
                  Hemos enviado un código de
                  confirmación a:
                </p>

                <strong>
                  {confirmationEmail}
                </strong>
              </div>

              {authError && (
                <p className="auth-error">
                  {authError}
                </p>
              )}

              <form onSubmit={handleConfirmation}>
                <label htmlFor="confirmation-code">
                  Código de confirmación
                </label>

                <input
                  id="confirmation-code"
                  name="code"
                  type="text"
                  placeholder="Ingresa el código"
                  required
                />

                <button
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading
                    ? 'Confirmando...'
                    : 'Confirmar cuenta'}
                </button>
              </form>

              <button
                type="button"
                className="back-button auth-back"
                onClick={() => {
                  setShowConfirmation(false)
                  setShowRegister(true)
                  setAuthError('')
                  setAuthMessage('')
                }}
              >
                ← Volver al registro
              </button>
            </div>
          </section>
        </main>

        <footer>
          <span>AWS Workshops Platform</span>
          <span>Proyecto Final</span>
        </footer>
      </div>
    )
  }

  // ---------------------------------------------------------
  // Panel de administración
  // ---------------------------------------------------------
  if (showAdminDashboard && isAdmin) {
    return (
      <AdminDashboard
        onBack={() => setShowAdminDashboard(false)}
      />
    )
  }

  // ---------------------------------------------------------
  // Fase 5.3 — Detalle del taller
  // ---------------------------------------------------------
  if (selectedWorkshop) {
    const disponibles =
      selectedWorkshop.cupos -
      selectedWorkshop.inscritos

    return (
      <div className="app">
        <header className="header">
          <div>
            <span className="eyebrow">
              AWS WORKSHOPS
            </span>

            <h1>Detalle del Taller</h1>

            <p>
              Consulta la información y disponibilidad
              del taller.
            </p>
          </div>

          <div className="header-actions">
            {isAuthenticated ? (
              <div className="user-session">
                <span className="user-email">
                  {currentUser?.username}
                </span>

                {isAdmin && (
                  <button
                    type="button"
                    className="header-login"
                    onClick={() => setShowAdminDashboard(true)}
                  >
                    ⚙️ Administración
                  </button>
                )}

                <button
                  type="button"
                  className="header-login"
                  onClick={handleLogout}
                >
                  Cerrar sesión
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="header-login"
                onClick={() => setShowLogin(true)}
              >
                Iniciar sesión
              </button>
            )}

            <div className="header-badge">
              <span>●</span>
              Plataforma activa
            </div>
          </div>
        </header>

        <main className="main">
          <section className="detail-container">
            <button
              type="button"
              className="back-button"
              onClick={() =>
                setSelectedWorkshop(null)
              }
            >
              ← Volver al catálogo
            </button>

            <article className="detail-card">
              <div className="detail-top">
                <span className="workshop-id">
                  TALLER {selectedWorkshop.id}
                </span>

                <span
                  className={
                    disponibles > 0
                      ? 'status available'
                      : 'status full'
                  }
                >
                  {disponibles > 0
                    ? 'Disponible'
                    : 'Agotado'}
                </span>
              </div>

              <span className="detail-category">
                {selectedWorkshop.categoria}
              </span>

              <h2>
                {selectedWorkshop.titulo}
              </h2>

              <p className="detail-description">
                {selectedWorkshop.descripcion}
              </p>

              <div className="detail-information">
                <div>
                  <span>Fecha</span>
                  <strong>
                    {selectedWorkshop.fecha}
                  </strong>
                </div>

                <div>
                  <span>Hora</span>
                  <strong>
                    {selectedWorkshop.hora}
                  </strong>
                </div>

                <div>
                  <span>Ubicación</span>
                  <strong>
                    {selectedWorkshop.ubicacion}
                  </strong>
                </div>

                <div>
                  <span>Cupos disponibles</span>
                  <strong>{disponibles}</strong>
                </div>
              </div>

              {authError && (
                <p className="auth-error">
                  {authError}
                </p>
              )}

              {authMessage && (
                <p className="auth-message">
                  {authMessage}
                </p>
              )}

              <div className="detail-actions">
                <button
                  type="button"
                  disabled={disponibles === 0}
                  onClick={async () => {
                    if (!isAuthenticated) {
                      setShowLogin(true)
                      return
                    }

                    try {
                      setAuthError('')
                      setAuthMessage('')
                      setIsLoading(true)

                      const result = await registerWorkshop(
                        selectedWorkshop.id,
                      )

                      console.log(
                        'Registro realizado correctamente:',
                        JSON.stringify(result, null, 2),
                      )

                      setAuthMessage(
                        'Registro realizado correctamente en el taller.',
                      )

                      const data = await getWorkshops()

                      const talleresAWS = data.items
                        .filter((item) => item.SK === 'META')
                        .map((item) => ({
                          id: item.id,
                          titulo: item.name,
                          descripcion: item.description,
                          fecha: new Date(item.startAt).toLocaleDateString(
                            'es-MX',
                          ),
                          hora: new Date(item.startAt).toLocaleTimeString(
                            'es-MX',
                            {
                              hour: '2-digit',
                              minute: '2-digit',
                            },
                          ),
                          cupos: Number(item.capacity ?? 0),
                          inscritos: Number(item.registeredCount ?? 0),
                          categoria: item.category,
                          ubicacion: item.location,
                        }))

                      setTalleres(talleresAWS)

                      const tallerActual = talleresAWS.find(
                        (taller) => taller.id === selectedWorkshop.id,
                      )

                      if (tallerActual) {
                        setSelectedWorkshop(tallerActual)
                      }
                    } catch (error) {
                      console.error(
                        'Error al registrar el taller:',
                        error,
                      )

                      setAuthError(
                        error instanceof Error
                          ? error.message
                          : 'No fue posible realizar la inscripción.',
                      )
                    } finally {
                      setIsLoading(false)
                    }
                  }}
                >
                  {disponibles > 0
                    ? 'Registrarme en este taller'
                    : 'Sin cupos disponibles'}
                </button>
              </div>
            </article>
          </section>
        </main>

        <footer>
          <span>AWS Workshops Platform</span>
          <span>Proyecto Final</span>
        </footer>
      </div>
    )
  }

  // ---------------------------------------------------------
  // Fase 5.2 — Catálogo
  // ---------------------------------------------------------
  return (
    <div className="app">
      <header className="header">
        <div>
          <span className="eyebrow">
            AWS WORKSHOPS
          </span>

          <h1>Catálogo de Talleres</h1>

          <p>
            Explora los talleres disponibles y registra
            tu participación.
          </p>
        </div>

        <div className="header-actions">
          {isAuthenticated ? (
            <div className="user-session">
              <span className="user-email">
                {currentUser?.username}
              </span>

              {isAdmin && (
                <button
                  type="button"
                  className="header-login"
                  onClick={() => setShowAdminDashboard(true)}
                >
                  ⚙️ Administración
                </button>
              )}

              <button
                type="button"
                className="header-login"
                onClick={handleLogout}
              >
                Cerrar sesión
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="header-login"
              onClick={() => setShowLogin(true)}
            >
              Iniciar sesión
            </button>
          )}

          <div className="header-badge">
            <span>●</span>
            Plataforma activa
          </div>
        </div>
      </header>

      <main className="main">
        <section className="summary">
          <div>
            <strong>{talleres.length}</strong>
            <span>Talleres disponibles</span>
          </div>

          <div>
            <strong>
              {talleres.reduce(
                (total, taller) =>
                  total + taller.cupos,
                0,
              )}
            </strong>

            <span>Cupos totales</span>
          </div>

          <div>
            <strong>
              {talleres.reduce(
                (total, taller) =>
                  total + taller.inscritos,
                0,
              )}
            </strong>

            <span>Inscripciones</span>
          </div>
        </section>

        <section className="catalog">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                CATÁLOGO
              </span>

              <h2>Talleres disponibles</h2>
            </div>

            <span className="count">
              {talleres.length} talleres
            </span>
          </div>

          <div className="workshop-grid">
            {talleres.map((taller) => {
              const disponibles =
                taller.cupos -
                taller.inscritos

              return (
                <article
                  className="workshop-card"
                  key={taller.id}
                >
                  <div className="card-top">
                    <span className="workshop-id">
                      TALLER {taller.id}
                    </span>

                    <span
                      className={
                        disponibles > 0
                          ? 'status available'
                          : 'status full'
                      }
                    >
                      {disponibles > 0
                        ? 'Disponible'
                        : 'Agotado'}
                    </span>
                  </div>

                  <h3>{taller.titulo}</h3>

                  <p className="description">
                    {taller.descripcion}
                  </p>

                  <div className="details">
                    <div>
                      <span>Fecha</span>
                      <strong>
                        {taller.fecha}
                      </strong>
                    </div>

                    <div>
                      <span>Hora</span>
                      <strong>
                        {taller.hora}
                      </strong>
                    </div>

                    <div>
                      <span>Cupos</span>
                      <strong>
                        {disponibles} disponibles
                      </strong>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setSelectedWorkshop(taller)
                    }
                  >
                    Ver taller
                  </button>
                </article>
              )
            })}
          </div>
        </section>
      </main>

      <footer>
        <span>AWS Workshops Platform</span>
        <span>Proyecto Final</span>
      </footer>
    </div>
  )
}

export default App