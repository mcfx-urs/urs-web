import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import TopBar from '@/components/TopBar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import VehiclePicker from '@/components/VehiclePicker'
import { GLASS_BACKGROUND_GRADIENT_CLASS } from '@/lib/glass-style'
import {
  changePassword,
  fetchUserProfile,
  updateDefaultVehicle,
  updateUserProfile,
  WrongCurrentPasswordError,
  type UserProfile,
} from '@/lib/settings'
import { fetchVehicles } from '@/lib/vehicles'

export default function SettingsPage() {
  const { data: profile, isLoading } = useQuery({ queryKey: ['user-profile'], queryFn: fetchUserProfile })

  if (isLoading || !profile) {
    return (
      <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
        <TopBar />
        <main className="mx-auto max-w-lg px-6 py-10">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </main>
      </div>
    )
  }

  return (
    <div className={`min-h-svh bg-background ${GLASS_BACKGROUND_GRADIENT_CLASS}`}>
      <TopBar />
      <main className="mx-auto flex max-w-lg flex-col gap-8 px-6 py-10">
        <h1 className="text-base font-bold">Settings</h1>
        <ProfileSection profile={profile} />
        <ChangePasswordSection />
        <DefaultVehicleSection defaultVehicleId={profile.user_default_vehicle_id} />
      </main>
    </div>
  )
}

function ProfileSection({ profile }: { profile: UserProfile }) {
  const [firstName, setFirstName] = useState(profile.user_firstname)
  const [lastName, setLastName] = useState(profile.user_lastname)
  const [birthday, setBirthday] = useState(profile.user_birthday)
  const [height, setHeight] = useState(profile.user_height)

  const saveMutation = useMutation({
    mutationFn: () =>
      updateUserProfile({
        user_firstname: firstName,
        user_lastname: lastName,
        user_birthday: birthday,
        user_height: height,
      }),
  })

  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-sm font-bold">Profile</h2>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          saveMutation.mutate()
        }}
      >
        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="first-name">First name</Label>
            <Input id="first-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="last-name">Last name</Label>
            <Input id="last-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="birthday">Birthday</Label>
            <Input id="birthday" type="date" value={birthday} onChange={(e) => setBirthday(e.target.value)} />
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="height">Height (cm)</Label>
            <Input id="height" type="number" value={height} onChange={(e) => setHeight(e.target.value)} />
          </div>
        </div>
        <Button type="submit" disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving...' : 'Save'}
        </Button>
        {saveMutation.isSuccess && <p className="text-sm text-muted-foreground">Saved</p>}
      </form>
    </section>
  )
}

function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const isValid = currentPassword.length > 0 && newPassword.length >= 8 && newPassword === confirmPassword

  const mutation = useMutation({
    mutationFn: () => changePassword(currentPassword, newPassword),
    onSuccess: () => {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    },
  })

  const wrongCurrentPassword = mutation.error instanceof WrongCurrentPasswordError

  return (
    <section className="flex flex-col gap-4 border-t border-border pt-6">
      <h2 className="text-sm font-bold">Change password</h2>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (isValid) mutation.mutate()
        }}
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="current-password">Current password</Label>
          <Input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="new-password">New password</Label>
          <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <Input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={!isValid || mutation.isPending}>
          {mutation.isPending ? 'Saving...' : 'Change password'}
        </Button>
        {mutation.isSuccess && <p className="text-sm text-muted-foreground">Password changed</p>}
        {wrongCurrentPassword && <p className="text-sm text-destructive">Current password is incorrect.</p>}
      </form>
    </section>
  )
}

function DefaultVehicleSection({ defaultVehicleId }: { defaultVehicleId: string }) {
  const { data: vehicles } = useQuery({ queryKey: ['vehicles'], queryFn: fetchVehicles })
  const [vehicleId, setVehicleId] = useState(defaultVehicleId)

  const mutation = useMutation({
    mutationFn: () => updateDefaultVehicle(vehicleId),
  })

  return (
    <section className="flex flex-col gap-4 border-t border-border pt-6">
      <h2 className="text-sm font-bold">Default vehicle</h2>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          mutation.mutate()
        }}
      >
        <VehiclePicker vehicles={vehicles ?? []} value={vehicleId} onChange={setVehicleId} includeNoneOption />
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving...' : 'Save'}
        </Button>
        {mutation.isSuccess && <p className="text-sm text-muted-foreground">Saved</p>}
      </form>
    </section>
  )
}
