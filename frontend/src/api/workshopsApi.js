import { fetchAuthSession } from 'aws-amplify/auth'

const API_BASE_URL =
  'https://8bawhid0r6.execute-api.us-east-1.amazonaws.com/Prod'

async function getAuthHeaders() {
  const session = await fetchAuthSession()

  const idToken = session.tokens?.idToken?.toString()

  if (!idToken) {
    throw new Error('No existe una sesión autenticada')
  }

  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${idToken}`,
  }
}

async function readResponseBody(response) {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

// ---------------------------------------------------------
// GET /workshops
// ---------------------------------------------------------
export async function getWorkshops() {
  const headers = await getAuthHeaders()

  const response = await fetch(`${API_BASE_URL}/workshops`, {
    method: 'GET',
    headers,
  })

  if (!response.ok) {
    const errorText = await response.text()

    throw new Error(
      `Error al obtener talleres (${response.status}): ${errorText}`,
    )
  }

  return readResponseBody(response)
}

// ---------------------------------------------------------
// POST /workshops
// ---------------------------------------------------------
export async function createWorkshop(workshop) {
  const headers = await getAuthHeaders()

  const response = await fetch(`${API_BASE_URL}/workshops`, {
    method: 'POST',
    headers,
    body: JSON.stringify(workshop),
  })

  const data = await readResponseBody(response)

  if (!response.ok) {
    throw new Error(
      data?.message ||
        `Error al crear el taller (${response.status})`,
    )
  }

  return data
}

// ---------------------------------------------------------
// PUT /workshops/{id}
// ---------------------------------------------------------
export async function updateWorkshop(workshopId, workshop) {
  if (!workshopId) {
    throw new Error('El ID del taller es obligatorio')
  }

  const headers = await getAuthHeaders()

  const response = await fetch(
    `${API_BASE_URL}/workshops/${workshopId}`,
    {
      method: 'PUT',
      headers,
      body: JSON.stringify(workshop),
    },
  )

  const data = await readResponseBody(response)

  if (!response.ok) {
    throw new Error(
      data?.message ||
        `Error al actualizar el taller (${response.status})`,
    )
  }

  return data
}

// ---------------------------------------------------------
// DELETE /workshops/{id}
// ---------------------------------------------------------
export async function deleteWorkshop(workshopId) {
  if (!workshopId) {
    throw new Error('El ID del taller es obligatorio')
  }

  const headers = await getAuthHeaders()

  const response = await fetch(
    `${API_BASE_URL}/workshops/${workshopId}`,
    {
      method: 'DELETE',
      headers,
    },
  )

  const data = await readResponseBody(response)

  if (!response.ok) {
    throw new Error(
      data?.message ||
        `Error al eliminar el taller (${response.status})`,
    )
  }

  return data
}
