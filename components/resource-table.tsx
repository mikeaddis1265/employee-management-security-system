"use client"

import type React from "react"

import { useState, useMemo } from "react"
import Link from "next/link"

interface Resource {
  id: string
  name: string
  level: string
  owner: string
  status: string
}

interface ResourceTableProps {
  data: Resource[]
}

const levelColors: Record<string, string> = {
  public: "bg-green-100 text-green-800",
  sensitive: "bg-yellow-100 text-yellow-800",
  confidential: "bg-orange-100 text-orange-800",
  "highly-sensitive": "bg-destructive/20 text-destructive",
}

export default function ResourceTable({ data }: ResourceTableProps) {
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [sortBy, setSortBy] = useState<"name" | "level" | "owner">("name")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc")
  const itemsPerPage = 5

  const filtered = useMemo(() => {
    const result = data.filter(
      (r) =>
        r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.owner.toLowerCase().includes(searchTerm.toLowerCase()),
    )

    result.sort((a, b) => {
      const aVal = a[sortBy]
      const bVal = b[sortBy]

      if (sortOrder === "desc") {
        return bVal.localeCompare(aVal)
      }
      return aVal.localeCompare(bVal)
    })

    return result
  }, [data, searchTerm, sortBy, sortOrder])

  const totalPages = Math.ceil(filtered.length / itemsPerPage)
  const paginatedData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const handleSort = (field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortBy(field)
      setSortOrder("asc")
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" && currentPage > 1) setCurrentPage(currentPage - 1)
    if (e.key === "ArrowRight" && currentPage < totalPages) setCurrentPage(currentPage + 1)
  }

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <input
        type="text"
        placeholder="Search resources by name or owner..."
        value={searchTerm}
        onChange={(e) => {
          setSearchTerm(e.target.value)
          setCurrentPage(1)
        }}
        onKeyDown={handleKeyPress}
        className="w-full px-4 py-2 border border-input rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
        aria-label="Search resources"
      />

      {/* Table */}
      <div className="overflow-x-auto border border-border rounded-lg">
        <table className="w-full" role="grid">
          <thead className="bg-secondary/30 border-b border-border">
            <tr>
              <th
                className="px-6 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-secondary/50 transition-colors"
                onClick={() => handleSort("name")}
              >
                <div className="flex items-center gap-2">
                  Name
                  {sortBy === "name" && <span className="text-xs">{sortOrder === "asc" ? "↑" : "↓"}</span>}
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-secondary/50 transition-colors"
                onClick={() => handleSort("level")}
              >
                <div className="flex items-center gap-2">
                  Security Level
                  {sortBy === "level" && <span className="text-xs">{sortOrder === "asc" ? "↑" : "↓"}</span>}
                </div>
              </th>
              <th
                className="px-6 py-3 text-left text-sm font-semibold cursor-pointer hover:bg-secondary/50 transition-colors"
                onClick={() => handleSort("owner")}
              >
                <div className="flex items-center gap-2">
                  Owner
                  {sortBy === "owner" && <span className="text-xs">{sortOrder === "asc" ? "↑" : "↓"}</span>}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Status</th>
              <th className="px-6 py-3 text-left text-sm font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedData.length > 0 ? (
              paginatedData.map((resource) => (
                <tr
                  key={resource.id}
                  className="border-b border-border hover:bg-secondary/20 transition-colors focus-within:bg-secondary/20"
                >
                  <td className="px-6 py-4 text-sm font-medium">{resource.name}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${levelColors[resource.level] || "bg-gray-100 text-gray-800"}`}
                    >
                      {resource.level}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-muted-foreground">{resource.owner}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                      <span className="w-2 h-2 bg-green-600 rounded-full" />
                      {resource.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 flex gap-3 text-sm font-medium">
                    <Link
                      href={`/resources/${resource.id}`}
                      className="text-primary hover:underline"
                      aria-label={`View ${resource.name}`}
                    >
                      View
                    </Link>
                    <button
                      className="text-primary hover:underline"
                      aria-label={`Edit ${resource.name}`}
                    >
                      Edit
                    </button>
                    <button
                      className="text-muted-foreground hover:text-destructive hover:underline"
                      aria-label={`Restrict access to ${resource.name}`}
                    >
                      Restrict
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">
                  No resources found. Try adjusting your search.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm">
        <p className="text-muted-foreground">
          Showing {paginatedData.length} of {filtered.length} resource{filtered.length !== 1 ? "s" : ""}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-2 border border-input rounded hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            aria-label="Previous page"
          >
            Prev
          </button>
          <span className="px-3 py-2 text-sm font-medium">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-2 border border-input rounded hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
            aria-label="Next page"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
