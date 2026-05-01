# Admin Auth Operations

Tomotono admin authentication uses a DB-backed `AdminUser` password check, one `AdminSession` row per successful login, and append-only `AdminLoginLog` audit rows for login/logout/session validation events.

## EC2 psql access

SSH or SSM into the EC2 instance, then open psql from the deployment directory:

```bash
cd /opt/tomotono-route-console
docker compose exec -T db psql -U tomotono -d tomotono_route_console
```

If the EC2 `.env` uses different `POSTGRES_USER` or `POSTGRES_DB` values, use those values instead.

## Recent login successes

```sql
SELECT created_at, email_attempted, ip_address, user_agent
FROM admin_login_logs
WHERE event_type = 'login_success'
ORDER BY created_at DESC
LIMIT 20;
```

## Recent login failures

```sql
SELECT created_at, email_attempted, failure_reason, ip_address
FROM admin_login_logs
WHERE event_type = 'login_failed'
ORDER BY created_at DESC
LIMIT 50;
```

## Repeated failures by IP in the last 24 hours

```sql
SELECT ip_address, count(*) AS fail_count, max(created_at) AS last_failed_at
FROM admin_login_logs
WHERE event_type = 'login_failed'
  AND created_at > now() - interval '24 hours'
GROUP BY ip_address
ORDER BY fail_count DESC
LIMIT 20;
```

## Specific admin account history

```sql
SELECT created_at, event_type, result, failure_reason, ip_address, user_agent
FROM admin_login_logs
WHERE email_attempted = 'admin@example.com'
ORDER BY created_at DESC
LIMIT 100;
```

For the current password-only MVP login form, replace `admin@example.com` with the configured `DEFAULT_ADMIN_IDENTIFIER` value, normally `tomotono_admin`.

## Recent invalid sessions

```sql
SELECT created_at, event_type, failure_reason, ip_address, user_agent
FROM admin_login_logs
WHERE event_type IN ('invalid_session', 'session_expired', 'session_revoked')
ORDER BY created_at DESC
LIMIT 50;
```

## Active sessions

```sql
SELECT s.id, u.username, s.created_at, s.expires_at, s.revoked_at, s.ip_address, s.user_agent
FROM admin_sessions s
JOIN "AdminUser" u ON u.id = s.admin_user_id
WHERE s.expires_at > now()
  AND s.revoked_at IS NULL
ORDER BY s.created_at DESC
LIMIT 50;
```

## Retention cleanup

Delete expired/revoked sessions older than seven days:

```sql
DELETE FROM admin_sessions
WHERE expires_at < now() - interval '7 days'
   OR revoked_at < now() - interval '7 days';
```

Keep login audit logs for 90 days:

```sql
DELETE FROM admin_login_logs
WHERE created_at < now() - interval '90 days';
```

## Security notes

- Raw session tokens are never stored in the database; only SHA-256 token hashes are stored in `admin_sessions.token_hash`.
- Raw passwords, password hashes, cookie values, Authorization headers, and full request bodies must not be inserted into `admin_login_logs`.
- Logout immediately marks the matching `admin_sessions.revoked_at` value and clears the `tomotono_admin_session` cookie.
