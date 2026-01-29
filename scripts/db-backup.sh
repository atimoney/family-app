#!/bin/bash
# Database backup/restore script for family-app

CONTAINER="family-db"
DB_USER="family"
DB_NAME="family"
BACKUP_DIR="./backups"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

case "$1" in
  backup)
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/family_${TIMESTAMP}.sql"
    echo "Creating backup: $BACKUP_FILE"
    docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$DB_NAME" > "$BACKUP_FILE"
    echo "Backup created successfully!"
    echo "To restore: ./scripts/db-backup.sh restore $BACKUP_FILE"
    ;;
  restore)
    if [ -z "$2" ]; then
      echo "Usage: ./scripts/db-backup.sh restore <backup_file>"
      echo "Available backups:"
      ls -la "$BACKUP_DIR"/*.sql 2>/dev/null || echo "No backups found"
      exit 1
    fi
    BACKUP_FILE="$2"
    if [ ! -f "$BACKUP_FILE" ]; then
      echo "Backup file not found: $BACKUP_FILE"
      exit 1
    fi
    echo "Restoring from: $BACKUP_FILE"
    echo "WARNING: This will overwrite the current database!"
    read -p "Continue? (y/N) " confirm
    if [ "$confirm" = "y" ] || [ "$confirm" = "Y" ]; then
      # Drop and recreate database
      docker exec "$CONTAINER" psql -U "$DB_USER" -c "DROP DATABASE IF EXISTS $DB_NAME;"
      docker exec "$CONTAINER" psql -U "$DB_USER" -c "CREATE DATABASE $DB_NAME;"
      # Restore
      cat "$BACKUP_FILE" | docker exec -i "$CONTAINER" psql -U "$DB_USER" "$DB_NAME"
      echo "Restore completed!"
    else
      echo "Restore cancelled"
    fi
    ;;
  list)
    echo "Available backups:"
    ls -lah "$BACKUP_DIR"/*.sql 2>/dev/null || echo "No backups found"
    ;;
  *)
    echo "Usage: ./scripts/db-backup.sh [backup|restore|list]"
    echo ""
    echo "Commands:"
    echo "  backup          - Create a new backup"
    echo "  restore <file>  - Restore from a backup file"
    echo "  list            - List available backups"
    ;;
esac
