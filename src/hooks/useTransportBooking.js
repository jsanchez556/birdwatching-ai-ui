import { useEffect, useMemo, useRef, useState } from 'react'
import { createTransportBooking, loadTransportCheckoutContext, loadTransportVehicles, quoteTransportRoute } from '../api/transportApi'

const emptyContact = { firstName: '', lastName: '', email: '', phone: '' }

export default function useTransportBooking({ auth }) {
  const [step, setStep] = useState(1)
  const [places, setPlaces] = useState({ origin: null, destination: null })
  const [ride, setRide] = useState({ date: '', time: '', passengers: 1 })
  const [route, setRoute] = useState(null)
  const [luggage, setLuggage] = useState(0)
  const [vehicles, setVehicles] = useState([])
  const [vehicle, setVehicle] = useState(null)
  const [contact, setContact] = useState(emptyContact)
  const [comments, setComments] = useState('')
  const [paymentMethod, setPaymentMethod] = useState({ type: 'pay_on_arrival' })
  const [status, setStatus] = useState({ type: 'idle', message: '' })
  const [confirmation, setConfirmation] = useState(null)
  const idempotencyKey = useRef(crypto.randomUUID())
  const vehicleRequestVersion = useRef(0)

  const invalidateBooking = () => {
    setConfirmation(null)
    idempotencyKey.current = crypto.randomUUID()
  }

  const token = async () => auth.isAuthenticated && !auth.isVisitor ? auth.getValidToken() : null
  const setPlace = (kind, place) => {
    setPlaces((current) => ({ ...current, [kind]: place }))
    setRoute(null); setVehicles([]); setVehicle(null)
    invalidateBooking()
  }
  const updateRide = (field, value) => {
    setRide((current) => ({ ...current, [field]: value }))
    setVehicles([]); setVehicle(null); invalidateBooking()
  }
  const calculateRoute = async () => {
    if (!places.origin?.placeId || !places.destination?.placeId) return
    setStatus({ type: 'loading', message: 'Calculating route…' })
    try {
      const result = await quoteTransportRoute({ originPlaceId: places.origin.placeId, destinationPlaceId: places.destination.placeId, token: await token() })
      setRoute(result); setPlaces({ origin: result.origin, destination: result.destination }); setStatus({ type: 'success', message: 'Route ready.' })
    } catch (error) { setStatus({ type: 'error', message: error.message }) }
  }
  const chooseVehicles = async () => {
    if (!route || !ride.date || !ride.time || Number(ride.passengers) < 1) return
    if (new Date(`${ride.date}T${ride.time}:00-06:00`) <= new Date()) { setStatus({ type: 'error', message: 'Choose a future pickup date and time.' }); return }
    setStatus({ type: 'loading', message: 'Loading eligible vehicles…' })
    try {
      const result = await loadTransportVehicles({ routeToken: route.routeToken, passengers: Number(ride.passengers), luggage, token: await token() })
      setVehicles(result); setVehicle(null); setStep(2); setStatus({ type: 'idle', message: '' })
    } catch (error) { setStatus({ type: 'error', message: error.message }) }
  }
  const refreshVehicles = async (nextLuggage) => {
    const normalizedLuggage = Number.isInteger(nextLuggage) ? Math.max(0, Math.min(100, nextLuggage)) : 0
    const requestVersion = ++vehicleRequestVersion.current
    setLuggage(normalizedLuggage); setVehicle(null); invalidateBooking()
    try {
      const result = await loadTransportVehicles({ routeToken: route.routeToken, passengers: Number(ride.passengers), luggage: normalizedLuggage, token: await token() })
      if (vehicleRequestVersion.current === requestVersion) setVehicles(result)
    }
    catch (error) { setStatus({ type: 'error', message: error.message }) }
  }
  const continueToContact = async () => {
    if (!vehicle) return
    if (auth.isAuthenticated && !auth.isVisitor) {
      try { const context = await loadTransportCheckoutContext({ token: await token() }); setContact({ ...emptyContact, ...context.contact }) }
      catch (error) { setStatus({ type: 'error', message: error.message }); return }
    }
    setStep(3)
  }
  const selectVehicle = (nextVehicle) => {
    setVehicle(nextVehicle)
    invalidateBooking()
  }
  const contactValid = useMemo(() => contact.firstName.trim() && contact.lastName.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email) && /^\+[1-9]\d{7,14}$/.test(contact.phone.replace(/[\s()-]/g, '')), [contact])
  const submit = async () => {
    setStatus({ type: 'loading', message: 'Confirming your ride…' })
    try {
      const pickupAt = `${ride.date}T${ride.time}:00-06:00`
      const result = await createTransportBooking({ token: await token(), booking: {
        routeToken: route.routeToken, quoteToken: vehicle.quoteToken, pickupAt,
        passengers: Number(ride.passengers), luggage, contact, comments, paymentMethod,
        idempotencyKey: idempotencyKey.current,
      } })
      setConfirmation(result); setStatus({ type: 'success', message: 'Transportation booked.' })
    } catch (error) { setStatus({ type: 'error', message: error.message }) }
  }
  useEffect(() => { if (comments.length > 1000) setComments((value) => value.slice(0, 1000)) }, [comments])
  return { step, setStep, places, setPlace, ride, updateRide, route, calculateRoute, luggage, refreshVehicles,
    vehicles, vehicle, selectVehicle, contact, setContact, comments, setComments, paymentMethod, setPaymentMethod,
    status, confirmation, contactValid, chooseVehicles, continueToContact, submit }
}
