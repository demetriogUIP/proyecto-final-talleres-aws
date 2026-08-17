import { useEffect, useState } from 'react'

import {
  createWorkshop,
  deleteWorkshop,
  getWorkshops,
  updateWorkshop,
} from './api/workshopsApi'

const EMPTY_FORM = {
  id: '',
  name: '',
  description: '',
  category: '',
  location: '',
  startAt: '',
  endAt: '',
  capacity: '',
  status: 'scheduled',
}

function AdminDashboard({ onBack }) {
  const [workshops, setWorkshops] = useState([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState(null)

  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const loadWorkshops = async () => {
    try {
      setIsLoading(true)
      setError('')

      const data = await getWorkshops()

      const items = Array.isArray(data?.items)
        ? data.items
        : []

      // Solo mostramos los elementos META del taller.
      // Las inscripciones también viven en DynamoDB.
      const workshopItems = items.filter(
        (item) => item.SK === 'META',
      )

      setWorkshops(workshopItems)
    } catch (error) {
      console.error(
        'Error al cargar talleres:',
        error,
      )

      setError(
        error?.message ||
          'No fue posible cargar los talleres.',
      )
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadWorkshops()
  }, [])

  const handleChange = (event) => {
    const { name, value } = event.target

    setForm((previous) => ({
      ...previous,
      [name]: value,
    }))
  }

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    setError('')
    setMessage('')
    setIsSaving(true)

    try {
      const workshopData = {
        name: form.name.trim(),
        description: form.description.trim(),
        category: form.category.trim(),
        location: form.location.trim(),
        startAt: form.startAt,
        endAt: form.endAt,
        capacity: Number(form.capacity),
        status: form.status,
      }

      if (
        !workshopData.name ||
        !workshopData.description ||
        !workshopData.category ||
        !workshopData.location ||
        !workshopData.startAt ||
        !workshopData.endAt ||
        !workshopData.capacity
      ) {
        throw new Error(
          'Completa todos los campos obligatorios.',
        )
      }

      if (workshopData.capacity <= 0) {
        throw new Error(
          'La capacidad debe ser mayor que cero.',
        )
      }

      if (editingId) {
        const result = await updateWorkshop(
          editingId,
          workshopData,
        )

        console.log(
          'Taller actualizado correctamente:',
          result,
        )

        setMessage(
          `El taller ${editingId} fue actualizado correctamente.`,
        )
      } else {
        if (!form.id.trim()) {
          throw new Error(
            'El ID del taller es obligatorio al crear uno nuevo.',
          )
        }

        const result = await createWorkshop({
          id: form.id.trim(),
          ...workshopData,
        })

        console.log(
          'Taller creado correctamente:',
          result,
        )

        setMessage(
          `El taller ${form.id.trim()} fue creado correctamente.`,
        )
      }

      resetForm()

      await loadWorkshops()
    } catch (error) {
      console.error(
        'Error al guardar taller:',
        error,
      )

      setError(
        error?.message ||
          'No fue posible guardar el taller.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleEdit = (workshop) => {
    setError('')
    setMessage('')

    setEditingId(workshop.id)

    setForm({
      id: workshop.id || '',
      name: workshop.name || '',
      description: workshop.description || '',
      category: workshop.category || '',
      location: workshop.location || '',
      startAt: workshop.startAt || '',
      endAt: workshop.endAt || '',
      capacity:
        workshop.capacity !== undefined
          ? String(workshop.capacity)
          : '',
      status: workshop.status || 'scheduled',
    })

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })
  }

  const handleDelete = async (workshop) => {
    const confirmed = window.confirm(
      `¿Seguro que deseas eliminar el taller ${workshop.id}?\n\n${workshop.name}`,
    )

    if (!confirmed) {
      return
    }

    try {
      setError('')
      setMessage('')
      setIsSaving(true)

      const result = await deleteWorkshop(
        workshop.id,
      )

      console.log(
        'Taller eliminado correctamente:',
        result,
      )

      setMessage(
        `El taller ${workshop.id} fue eliminado correctamente.`,
      )

      if (editingId === workshop.id) {
        resetForm()
      }

      await loadWorkshops()
    } catch (error) {
      console.error(
        'Error al eliminar taller:',
        error,
      )

      setError(
        error?.message ||
          'No fue posible eliminar el taller.',
      )
    } finally {
      setIsSaving(false)
    }
  }

  const formatDate = (value) => {
    if (!value) {
      return '—'
    }

    const date = new Date(value)

    if (Number.isNaN(date.getTime())) {
      return value
    }

    return date.toLocaleString('es-PA', {
      dateStyle: 'short',
      timeStyle: 'short',
    })
  }

  return (
    <section className="admin-dashboard">
      <div className="admin-dashboard-header">
        <div>
          <span className="detail-category">
            Administración
          </span>

          <h2>Gestión de talleres</h2>

          <p>
            Crea, consulta, modifica y elimina talleres
            de la plataforma.
          </p>
        </div>

        <button
          type="button"
          className="back-button"
          onClick={onBack}
        >
          ← Volver al catálogo
        </button>
      </div>

      {message && (
        <div className="auth-message">
          {message}
        </div>
      )}

      {error && (
        <div className="auth-error">
          {error}
        </div>
      )}

      <div className="admin-form-card">
        <div className="admin-form-header">
          <div>
            <h3>
              {editingId
                ? `Editar taller ${editingId}`
                : 'Crear nuevo taller'}
            </h3>

            <p>
              {editingId
                ? 'Modifica la información del taller seleccionado.'
                : 'Completa la información para publicar un nuevo taller.'}
            </p>
          </div>

          {editingId && (
            <button
              type="button"
              className="header-login"
              onClick={resetForm}
              disabled={isSaving}
            >
              Cancelar edición
            </button>
          )}
        </div>

        <form
          className="admin-form"
          onSubmit={handleSubmit}
        >
          <div className="admin-form-grid">
            <label>
              ID del taller
              <input
                name="id"
                value={form.id}
                onChange={handleChange}
                disabled={Boolean(editingId) || isSaving}
                placeholder="Ej. 006"
                required={!editingId}
              />
            </label>

            <label>
              Nombre
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                disabled={isSaving}
                placeholder="Nombre del taller"
                required
              />
            </label>

            <label>
              Categoría
              <input
                name="category"
                value={form.category}
                onChange={handleChange}
                disabled={isSaving}
                placeholder="AWS Serverless"
                required
              />
            </label>

            <label>
              Ubicación
              <input
                name="location"
                value={form.location}
                onChange={handleChange}
                disabled={isSaving}
                placeholder="Laboratorio 1"
                required
              />
            </label>

            <label>
              Inicio
              <input
                type="datetime-local"
                name="startAt"
                value={
                  form.startAt
                    ? form.startAt.slice(0, 16)
                    : ''
                }
                onChange={(event) => {
                  const value =
                    event.target.value

                  setForm((previous) => ({
                    ...previous,
                    startAt: value
                      ? new Date(value).toISOString()
                      : '',
                  }))
                }}
                disabled={isSaving}
                required
              />
            </label>

            <label>
              Finalización
              <input
                type="datetime-local"
                name="endAt"
                value={
                  form.endAt
                    ? form.endAt.slice(0, 16)
                    : ''
                }
                onChange={(event) => {
                  const value =
                    event.target.value

                  setForm((previous) => ({
                    ...previous,
                    endAt: value
                      ? new Date(value).toISOString()
                      : '',
                  }))
                }}
                disabled={isSaving}
                required
              />
            </label>

            <label>
              Capacidad
              <input
                type="number"
                name="capacity"
                min="1"
                value={form.capacity}
                onChange={handleChange}
                disabled={isSaving}
                placeholder="20"
                required
              />
            </label>

            <label>
              Estado
              <select
                name="status"
                value={form.status}
                onChange={handleChange}
                disabled={isSaving}
              >
                <option value="scheduled">
                  Programado
                </option>

                <option value="cancelled">
                  Cancelado
                </option>

                <option value="completed">
                  Completado
                </option>
              </select>
            </label>

            <label className="admin-form-full">
              Descripción
              <textarea
                name="description"
                value={form.description}
                onChange={handleChange}
                disabled={isSaving}
                rows="4"
                placeholder="Descripción del taller"
                required
              />
            </label>
          </div>

          <div className="admin-form-actions">
            <button
              type="submit"
              disabled={isSaving}
            >
              {isSaving
                ? 'Guardando...'
                : editingId
                  ? 'Guardar cambios'
                  : 'Crear taller'}
            </button>

            {!editingId && (
              <button
                type="button"
                className="header-login"
                onClick={resetForm}
                disabled={isSaving}
              >
                Limpiar
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="admin-list-card">
        <div className="admin-list-header">
          <div>
            <h3>Talleres registrados</h3>

            <p>
              {workshops.length} taller
              {workshops.length === 1
                ? ''
                : 'es'} encontrado
              {workshops.length === 1
                ? ''
                : 's'}.
            </p>
          </div>

          <button
            type="button"
            className="header-login"
            onClick={loadWorkshops}
            disabled={isLoading || isSaving}
          >
            {isLoading
              ? 'Actualizando...'
              : 'Actualizar'}
          </button>
        </div>

        {isLoading ? (
          <p className="admin-empty">
            Cargando talleres...
          </p>
        ) : workshops.length === 0 ? (
          <p className="admin-empty">
            No existen talleres registrados.
          </p>
        ) : (
          <div className="admin-workshop-list">
            {workshops.map((workshop) => {
              const capacity =
                Number(workshop.capacity) || 0

              const registered =
                Number(
                  workshop.registeredCount,
                ) || 0

              const available = Math.max(
                capacity - registered,
                0,
              )

              return (
                <article
                  key={workshop.id}
                  className="admin-workshop-card"
                >
                  <div className="admin-workshop-info">
                    <div className="detail-top">
                      <span className="workshop-id">
                        TALLER {workshop.id}
                      </span>

                      <span
                        className={
                          available > 0
                            ? 'status available'
                            : 'status full'
                        }
                      >
                        {available > 0
                          ? 'Disponible'
                          : 'Agotado'}
                      </span>
                    </div>

                    <span className="detail-category">
                      {workshop.category}
                    </span>

                    <h3>{workshop.name}</h3>

                    <p>
                      {workshop.description}
                    </p>

                    <div className="admin-workshop-data">
                      <span>
                        <strong>Ubicación:</strong>{' '}
                        {workshop.location}
                      </span>

                      <span>
                        <strong>Inicio:</strong>{' '}
                        {formatDate(
                          workshop.startAt,
                        )}
                      </span>

                      <span>
                        <strong>Capacidad:</strong>{' '}
                        {capacity}
                      </span>

                      <span>
                        <strong>Inscritos:</strong>{' '}
                        {registered}
                      </span>

                      <span>
                        <strong>Disponibles:</strong>{' '}
                        {available}
                      </span>
                    </div>
                  </div>

                  <div className="admin-workshop-actions">
                    <button
                      type="button"
                      onClick={() =>
                        handleEdit(workshop)
                      }
                      disabled={isSaving}
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      className="danger-button"
                      onClick={() =>
                        handleDelete(workshop)
                      }
                      disabled={isSaving}
                    >
                      Eliminar
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

export default AdminDashboard