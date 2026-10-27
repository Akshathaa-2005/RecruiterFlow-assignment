import { nanoid } from '@reduxjs/toolkit'
import { useCallback } from 'react'
import type { Member } from '../types'
import { useAppDispatch } from './hooks'
import { memberAdded } from './tripSlice'

/** Adds a member to the trip and returns them, so a form can select them. */
export function useAddMember(): (name: string) => Member {
  const dispatch = useAppDispatch()
  return useCallback(
    (name: string) => {
      const member = { id: nanoid(), name }
      dispatch(memberAdded(member))
      return member
    },
    [dispatch],
  )
}
