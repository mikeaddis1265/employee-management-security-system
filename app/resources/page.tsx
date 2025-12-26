"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import toast from "react-hot-toast"

interface Resource {
  id: number
  name: string
  description?: string
  sensitivityLevel: string
  owner: string
  ownerRole: string
  content?: any
  createdAt: string
  canRead: boolean
  canWrite: boolean
}

export default function ResourcesPage() {
  const router = useRouter()
  const [resources, setResources] = useState<Resource[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  // Create resource form
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDescription, setNewDescription] = useState("")
  const [newLevel, setNewLevel] = useState<"PUBLIC" | "INTERNAL" | "CONFIDENTIAL">("PUBLIC")
  const [newContent, setNewContent] = useState('{\n  "example": "value"\n}')

  useEffect(() => {
    fetchResources()
  }, [])

  const fetchResources = async () => {
    try {
      const res = await fetch("/api/resources")
      const data = await res.json()

      if (data.success) {
        setResources(data.resources || [])
      } else {
        toast.error("Failed to load resources")
      }
    } catch (error) {
      console.error("Error fetching resources:", error)
      toast.error("Failed to load resources")
    } finally {
      setLoading(false)
    }
  }

  const handleCreateResource = async () => {
    if (!newName.trim()) {
      toast.error("Resource name is required")
      return
    }

    setCreating(true)
    try {
      let contentData
      try {
        contentData = JSON.parse(newContent)
      } catch {
        toast.error("Invalid JSON in content field")
        setCreating(false)
        return
      }

      const res = await fetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          description: newDescription,
          sensitivityLevel: newLevel,
          content: contentData,
        }),
      })

      const result = await res.json()

      if (result.success) {
        toast.success("Resource created successfully!")
        setNewName("")
        setNewDescription("")
        setNewLevel("PUBLIC")
        setNewContent('{\n  "example": "value"\n}')
        setShowCreateForm(false)
        fetchResources() // Refresh list
      } else {
        toast.error(result.error || "Failed to create resource")
      }
    } catch (error) {
      console.error("Create resource error:", error)
      toast.error("Failed to create resource")
    } finally {
      setCreating(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Resources</h1>
            <p className="text-muted-foreground mt-1">
              Manage and access resources based on your permissions
            </p>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Create Resource
          </button>
        </div>

        {/* Create Resource Form */}
        {showCreateForm && (
          <div className="p-6 border border-border rounded-lg bg-card space-y-4">
            <h2 className="text-xl font-bold">Create New Resource</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Resource name"
                  className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Sensitivity Level *</label>
                <select
                  value={newLevel}
                  onChange={(e) => setNewLevel(e.target.value as any)}
                  className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="PUBLIC">PUBLIC</option>
                  <option value="INTERNAL">INTERNAL</option>
                  <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional description"
                className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Content (JSON)</label>
              <textarea
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={8}
                className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary font-mono text-sm"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCreateResource}
                disabled={creating}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Resource"}
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 border border-input rounded-lg font-medium hover:bg-secondary transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Resources List */}
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-secondary/30">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold">Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Level</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Owner</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Created</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Access</th>
                <th className="px-4 py-3 text-left text-sm font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {resources.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    No resources found. Create one to get started.
                  </td>
                </tr>
              ) : (
                resources.map((resource) => (
                  <tr key={resource.id} className="border-t border-border hover:bg-secondary/10">
                    <td className="px-4 py-3">
                      <div>
                        <div className="font-medium">{resource.name}</div>
                        {resource.description && (
                          <div className="text-sm text-muted-foreground">{resource.description}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          resource.sensitivityLevel === "PUBLIC"
                            ? "bg-green-100 text-green-800"
                            : resource.sensitivityLevel === "INTERNAL"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {resource.sensitivityLevel}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm">{resource.owner}</td>
                    <td className="px-4 py-3 text-sm">
                      {new Date(resource.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {resource.canRead && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                            Read
                          </span>
                        )}
                        {resource.canWrite && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                            Write
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => router.push(`/resources/${resource.id}`)}
                        className="text-primary hover:underline text-sm font-medium"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="text-sm text-muted-foreground">
          <p>Showing {resources.length} resource(s)</p>
        </div>
      </div>
    </div>
  )
}
