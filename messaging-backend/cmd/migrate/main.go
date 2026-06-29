// Command migrate applies or dry-runs the messaging service PostgreSQL migrations.
package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"

	"github.com/jackc/pgx/v5"
)

func main() {
	mode := flag.String("mode", "dry-run", "migration mode: dry-run or apply")
	dir := flag.String("dir", "internal/store/migrations", "directory containing *.sql migrations")
	timeout := flag.Duration("timeout", 30*time.Second, "migration timeout")
	flag.Parse()

	if *mode != "dry-run" && *mode != "apply" {
		fail("mode must be dry-run or apply")
	}
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		fail("DATABASE_URL is required")
	}

	files, err := filepath.Glob(filepath.Join(*dir, "*.sql"))
	if err != nil {
		fail(err.Error())
	}
	if len(files) == 0 {
		fail("no migration files found")
	}
	sort.Strings(files)

	ctx, cancel := context.WithTimeout(context.Background(), *timeout)
	defer cancel()

	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		fail("connect: " + err.Error())
	}
	defer conn.Close(context.Background())

	tx, err := conn.Begin(ctx)
	if err != nil {
		fail("begin: " + err.Error())
	}

	for _, file := range files {
		sql, err := os.ReadFile(file)
		if err != nil {
			_ = tx.Rollback(context.Background())
			fail("read " + file + ": " + err.Error())
		}
		if _, err := tx.Exec(ctx, string(sql)); err != nil {
			_ = tx.Rollback(context.Background())
			fail("execute " + file + ": " + err.Error())
		}
		fmt.Printf("ok %s\n", file)
	}

	if *mode == "dry-run" {
		if err := tx.Rollback(ctx); err != nil {
			fail("rollback dry-run: " + err.Error())
		}
		fmt.Printf("dry-run complete: %d migrations validated and rolled back\n", len(files))
		return
	}

	if err := tx.Commit(ctx); err != nil {
		fail("commit: " + err.Error())
	}
	fmt.Printf("apply complete: %d migrations applied\n", len(files))
}

func fail(msg string) {
	fmt.Fprintln(os.Stderr, "migrate:", msg)
	os.Exit(1)
}
