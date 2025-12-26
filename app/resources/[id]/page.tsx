"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import toast from "react-hot-toast"

const resourceEditSchema = z.object({
  name: z.string().min(1, "Name required"),
  content: z.string(),
})

type ResourceEditData = z.infer<typeof resourceEditSchema>

interface Resource {
  id: number
  name: string
  description?: string
  sensitivityLevel: string
  owner: string
  ownerRole: string
  content: any
  createdAt: string
  updatedAt: string
  canRead: boolean
  canWrite: boolean
  isOwner?: boolean
  permissions?: {
    id: number
    userId: string
    username: string
    permissionType: 'READ' | 'WRITE'
    grantedAt: string
  }[]
}

export default function ResourceDetailPage() {
  const params = useParams()
  const id = params.id as string
  const [isEditing, setIsEditing] = useState(false)
  const [showJSON, setShowJSON] = useState(true)
  const [resource, setResource] = useState<Resource | null>(null)
  const [loading, setLoading] = useState(true)
  const [grantUsername, setGrantUsername] = useState("")
  const [grantType, setGrantType] = useState<"READ" | "WRITE">("READ")
  const [granting, setGranting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
    reset,
  } = useForm<ResourceEditData>({
    resolver: zodResolver(resourceEditSchema),
  })

  useEffect(() => {
    async function fetchResource() {
      try {
        const res = await fetch(`/api/resources/${id}`)
        const data = await res.json()

        if (data.success) {
          setResource(data.resource)
          reset({
            name: data.resource.name,
            content: JSON.stringify(data.resource.content || {}, null, 2),
          })
        } else {
          toast.error(data.error || "Failed to load resource")
        }
      } catch (error) {
        console.error("Error fetching resource:", error)
        toast.error("Failed to load resource")
      } finally {
        setLoading(false)
      }
    }

    if (id) {
      fetchResource()
    }
  }, [id, reset])

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
          <p className="text-muted-foreground">Loading resource...</p>
        </div>
      </div>
    )
  }

  if (!resource) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
          <h1 className="text-3xl font-bold text-destructive">404 - Resource Not Found</h1>
          <p className="text-muted-foreground max-w-md">
            The resource you're looking for doesn't exist or you don't have permission to access it.
          </p>
          <a href="/dashboard" className="text-primary hover:underline font-medium">
            Return to Dashboard
          </a>
        </div>
      </div>
    )
  }

  if (!resource.canRead) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col items-center justify-center py-16 space-y-4 text-center">
          <h1 className="text-3xl font-bold text-destructive">Access Denied</h1>
          <p className="text-muted-foreground max-w-md">
            You don't have read access to <strong>{resource.name}</strong>. This is a {resource.sensitivityLevel.toLowerCase()} resource.
          </p>
          <a href="/dashboard" className="text-primary hover:underline font-medium">
            Return to Dashboard
          </a>
        </div>
      </div>
    )
  }

  const onSubmit = async (data: ResourceEditData) => {
    try {
      toast.loading("Saving changes...")

      let contentData
      try {
        contentData = JSON.parse(data.content)
      } catch {
        toast.error("Invalid JSON in content field")
        return
      }

      const res = await fetch(`/api/resources/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          content: contentData,
        }),
      })

      const result = await res.json()
      toast.dismiss()

      if (result.success) {
        toast.success("Resource updated successfully!")
        setResource(result.resource)
        setIsEditing(false)
      } else {
        toast.error(result.error || "Failed to update resource")
      }
    } catch (error) {
      toast.dismiss()
      toast.error("Failed to update resource")
    }
  }

  const handleGrantPermission = async () => {
    if (!grantUsername.trim()) {
      toast.error("Please enter a username")
      return
    }
    setGranting(true)
    try {
      const res = await fetch(`/api/resources/${id}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: grantUsername.trim(), permissionType: grantType }),
      })
      const result = await res.json()
      if (!res.ok || !result.success) {
        toast.error(result.error || "Failed to grant permission")
      } else {
        toast.success("Permission granted")
        setGrantUsername("")
        // Refresh resource to show updated permissions
        window.location.reload()
      }
    } catch (error) {
      toast.error("Failed to grant permission")
    } finally {
      setGranting(false)
    }
  }

  const handleRevokePermission = async (permissionId: number) => {
    try {
      const res = await fetch(`/api/resources/${id}/permissions`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionId }),
      })
      const result = await res.json()
      if (!res.ok || !result.success) {
        toast.error(result.error || "Failed to revoke permission")
      } else {
        toast.success("Permission revoked")
        window.location.reload()
      }
    } catch (error) {
      toast.error("Failed to revoke permission")
    }
  }

  const handleDeleteResource = async () => {
    if (!confirm("Are you sure you want to delete this resource and its file? This action cannot be undone.")) {
      return
    }
    setDeleting(true)
    try {
      const res = await fetch(`/api/resources/${id}`, {
        method: "DELETE",
      })
      const result = await res.json()
      if (!res.ok || !result.success) {
        toast.error(result.error || "Failed to delete resource")
      } else {
        toast.success("Resource deleted successfully")
        window.location.href = "/dashboard"
      }
    } catch (error) {
      toast.error("Failed to delete resource")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/*
        If this resource was created via file upload, its metadata (filename, storedAs path, mimeType, size)
        is stored inside the JSON content. We surface that clearly for the user here.
      */}
      {resource.content && (resource.content as any).storedAs && (
        <div className="p-4 border border-primary/30 rounded-lg bg-primary/5 space-y-2">
          <h2 className="text-lg font-semibold">Uploaded File</h2>
          <p className="text-sm">
            <span className="font-medium">Original name:</span>{" "}
            {(resource.content as any).filename || "N/A"}
          </p>
          <p className="text-sm">
            <span className="font-medium">Stored path:</span>{" "}
            {(resource.content as any).storedAs}
          </p>
          <p className="text-sm">
            <span className="font-medium">Type:</span>{" "}
            {(resource.content as any).mimeType || "unknown"}
          </p>
          <p className="text-sm">
            <span className="font-medium">Size:</span>{" "}
            {(resource.content as any).size
              ? `${Math.round(((resource.content as any).size as number) / 1024)} KB`
              : "unknown"}
          </p>
          <a
            href={(resource.content as any).storedAs}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Download / View File
          </a>
        </div>
      )}
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold">{resource.name}</h1>
            <p className="text-muted-foreground">Resource ID: {id}</p>
          </div>
          <div className="flex items-center gap-3">
            {resource.isOwner && (
              <button
                type="button"
                onClick={handleDeleteResource}
                disabled={deleting}
                className="px-3 py-1.5 text-xs font-medium rounded-lg border border-destructive text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete Resource"}
              </button>
            )}
            <a href="/dashboard" className="text-primary hover:underline text-sm font-medium">
              Back to Dashboard
            </a>
          </div>
        </div>

        {/* Resource Metadata */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 bg-secondary/20 rounded-lg">
            <p className="text-xs text-muted-foreground">Security Level</p>
            <p className="font-semibold capitalize">{resource.sensitivityLevel.toLowerCase()}</p>
          </div>
          <div className="p-3 bg-secondary/20 rounded-lg">
            <p className="text-xs text-muted-foreground">Owner</p>
            <p className="font-semibold">{resource.owner}</p>
          </div>
          <div className="p-3 bg-secondary/20 rounded-lg">
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="font-semibold capitalize text-green-600">active</p>
          </div>
          <div className="p-3 bg-secondary/20 rounded-lg">
            <p className="text-xs text-muted-foreground">Created</p>
            <p className="font-semibold">{new Date(resource.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        {/* Permissions */}
        <div className="flex gap-3 text-sm">
          <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
            <span className="text-green-800">Read Access</span>
          </div>
          {resource.canWrite && (
            <div className="px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
              <span className="text-green-800">Write Access</span>
            </div>
          )}
        </div>
      </div>

      {/* Content Viewer / Editor */}
      {!isEditing ? (
        <div className="space-y-4 p-6 border border-border rounded-lg bg-card">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Resource Content</h2>
            <button onClick={() => setShowJSON(!showJSON)} className="text-sm text-primary hover:underline">
              {showJSON ? "Show Table View" : "Show JSON"}
            </button>
          </div>

          {showJSON ? (
            <pre className="p-4 bg-background rounded-lg border border-border overflow-auto max-h-96 text-sm font-mono text-foreground">
              {JSON.stringify(resource.content, null, 2)}
            </pre>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {Object.entries(resource.content).map(([key, value]) => (
                    <tr key={key} className="border-b border-border hover:bg-secondary/20">
                      <td className="px-4 py-3 font-medium text-muted-foreground">{key}</td>
                      <td className="px-4 py-3">{JSON.stringify(value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {resource.canWrite && (
            <button
              onClick={() => setIsEditing(true)}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Edit Resource
            </button>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 p-6 border border-border rounded-lg bg-card">
          <h2 className="text-lg font-bold">Edit Resource</h2>

          <div>
            <label className="block text-sm font-medium mb-2">Resource Name</label>
            <input
              {...register("name")}
              type="text"
              className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Content (JSON)</label>
            <textarea
              {...register("content")}
              rows={10}
              className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              Save Changes
            </button>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 border border-input rounded-lg font-medium hover:bg-secondary transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* DAC Permissions Management (only visible to owner) */}
      {resource.isOwner && (
        <div className="space-y-4 p-6 border border-border rounded-lg bg-card">
          <h2 className="text-lg font-bold">Discretionary Access Control (DAC)</h2>
          <p className="text-sm text-muted-foreground">
            As the owner, you can grant or revoke READ/WRITE permissions for other users on this resource.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Grant Permission</h3>
              <input
                type="text"
                placeholder="Target username"
                value={grantUsername}
                onChange={(e) => setGrantUsername(e.target.value)}
                className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <select
                value={grantType}
                onChange={(e) => setGrantType(e.target.value as "READ" | "WRITE")}
                className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="READ">READ</option>
                <option value="WRITE">WRITE</option>
              </select>
              <button
                type="button"
                onClick={handleGrantPermission}
                disabled={granting}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {granting ? "Granting..." : "Grant Permission"}
              </button>
            </div>

            <div className="space-y-3">
              <h3 className="font-semibold text-sm">Existing Permissions</h3>
              {resource.permissions && resource.permissions.length > 0 ? (
                <div className="border border-border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-secondary/30">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold">User</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold">Type</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resource.permissions.map((p) => (
                        <tr key={p.id} className="border-t border-border">
                          <td className="px-3 py-2">{p.username}</td>
                          <td className="px-3 py-2">{p.permissionType}</td>
                          <td className="px-3 py-2">
                            <button
                              type="button"
                              onClick={() => handleRevokePermission(p.id)}
                              className="text-destructive text-xs hover:underline"
                            >
                              Revoke
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No additional permissions granted yet.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
