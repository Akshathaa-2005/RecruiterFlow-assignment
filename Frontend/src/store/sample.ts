import sampleJson from '../data/sample-data.json'
import type { TripData } from '../types'
import { parseTripData } from './parse'

function loadSample(): TripData {
  const data = parseTripData(sampleJson)
  if (!data) throw new Error('src/data/sample-data.json is not valid trip data')
  return data
}

export const sampleData: TripData = loadSample()
