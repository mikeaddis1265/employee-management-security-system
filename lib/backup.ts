import { exec } from 'child_process'
import { promisify } from 'util'
import { promises as fs } from 'fs'
import path from 'path'
import { logSystemEvent } from './logger'

const execAsync = promisify(exec)

const BACKUP_DIR = path.join(process.cwd(), 'backups')
const MAX_BACKUPS = 30 // Keep last 30 backups

/**
 * Ensure backup directory exists
 */
async function ensureBackupDir(): Promise<void> {
  try {
    await fs.access(BACKUP_DIR)
  } catch {
    await fs.mkdir(BACKUP_DIR, { recursive: true })
  }
}

/**
 * Perform database backup using pg_dump
 */
export async function performBackup(): Promise<{ success: boolean; filename?: string; error?: string }> {
  try {
    await ensureBackupDir()

    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '')
    const filename = `backup-${timestamp}.sql`
    const filepath = path.join(BACKUP_DIR, filename)

    // Get database URL from environment
    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      throw new Error('DATABASE_URL not configured')
    }

    console.log(`[BACKUP] Starting backup: ${filename}`)

    // Execute pg_dump
    // Note: On Windows, you may need to specify full path to pg_dump
    const command = `pg_dump "${databaseUrl}" > "${filepath}"`

    try {
      await execAsync(command)
    } catch (error: any) {
      // Try alternative command for Windows
      const pgDumpPath = 'pg_dump' // Or specify full path like: "C:\\Program Files\\PostgreSQL\\16\\bin\\pg_dump"
      const altCommand = `"${pgDumpPath}" "${databaseUrl}" -f "${filepath}"`
      await execAsync(altCommand)
    }

    // Verify backup file was created
    const stats = await fs.stat(filepath)
    if (stats.size === 0) {
      throw new Error('Backup file is empty')
    }

    console.log(`[BACKUP] Success: ${filename} (${(stats.size / 1024).toFixed(2)} KB)`)

    // Log to system
    await logSystemEvent('backup_created', {
      filename,
      size: stats.size,
      timestamp: new Date(),
    })

    // Clean up old backups
    await cleanupOldBackups()

    return { success: true, filename }
  } catch (error: any) {
    console.error('[BACKUP] Failed:', error.message)

    await logSystemEvent('backup_failed', {
      error: error.message,
      timestamp: new Date(),
    })

    return { success: false, error: error.message }
  }
}

/**
 * Clean up old backups, keeping only the most recent ones
 */
async function cleanupOldBackups(): Promise<void> {
  try {
    const files = await fs.readdir(BACKUP_DIR)
    const backupFiles = files
      .filter((f) => f.startsWith('backup-') && f.endsWith('.sql'))
      .map((f) => ({
        name: f,
        path: path.join(BACKUP_DIR, f),
      }))

    // Sort by name (which includes timestamp)
    backupFiles.sort((a, b) => b.name.localeCompare(a.name))

    // Delete old backups
    const toDelete = backupFiles.slice(MAX_BACKUPS)
    for (const file of toDelete) {
      await fs.unlink(file.path)
      console.log(`[BACKUP] Deleted old backup: ${file.name}`)
    }

    if (toDelete.length > 0) {
      await logSystemEvent('backup_cleanup', {
        deletedCount: toDelete.length,
        keptCount: backupFiles.length - toDelete.length,
      })
    }
  } catch (error: any) {
    console.error('[BACKUP] Cleanup failed:', error.message)
  }
}

/**
 * Get list of available backups
 */
export async function listBackups(): Promise<
  Array<{ filename: string; size: number; created: Date }>
> {
  try {
    await ensureBackupDir()
    const files = await fs.readdir(BACKUP_DIR)

    const backups = []
    for (const file of files) {
      if (file.startsWith('backup-') && file.endsWith('.sql')) {
        const filepath = path.join(BACKUP_DIR, file)
        const stats = await fs.stat(filepath)
        backups.push({
          filename: file,
          size: stats.size,
          created: stats.birthtime,
        })
      }
    }

    // Sort by creation date (newest first)
    backups.sort((a, b) => b.created.getTime() - a.created.getTime())

    return backups
  } catch (error) {
    console.error('[BACKUP] List failed:', error)
    return []
  }
}

/**
 * Restore database from backup file
 */
export async function restoreBackup(filename: string): Promise<{ success: boolean; error?: string }> {
  try {
    const filepath = path.join(BACKUP_DIR, filename)

    // Verify file exists
    await fs.access(filepath)

    const databaseUrl = process.env.DATABASE_URL
    if (!databaseUrl) {
      throw new Error('DATABASE_URL not configured')
    }

    console.log(`[BACKUP] Restoring from: ${filename}`)

    // Execute psql to restore
    const command = `psql "${databaseUrl}" < "${filepath}"`

    try {
      await execAsync(command)
    } catch (error: any) {
      // Try alternative command for Windows
      const psqlPath = 'psql' // Or specify full path
      const altCommand = `"${psqlPath}" "${databaseUrl}" -f "${filepath}"`
      await execAsync(altCommand)
    }

    console.log(`[BACKUP] Restore successful: ${filename}`)

    await logSystemEvent('backup_restored', {
      filename,
      timestamp: new Date(),
    })

    return { success: true }
  } catch (error: any) {
    console.error('[BACKUP] Restore failed:', error.message)

    await logSystemEvent('backup_restore_failed', {
      filename,
      error: error.message,
    })

    return { success: false, error: error.message }
  }
}

/**
 * Manual backup trigger for testing
 */
export async function triggerManualBackup(): Promise<void> {
  console.log('[BACKUP] Manual backup triggered')
  await performBackup()
}

// Export backup directory path for API routes
export { BACKUP_DIR }
