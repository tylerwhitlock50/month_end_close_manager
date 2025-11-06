# Production Deployment - Quick Reference

## 🎯 Pre-Deployment Checklist

Use this as your quick reference guide. For detailed instructions, see `PRODUCTION_READINESS_CHECKLIST.md`.

---

## Phase 1: Configuration (2-3 hours)

### ✅ Step 1: Environment File
- [ ] Copy `env.example` to environment-specific `.env` files (local/staging/prod)
- [ ] Generate unique `SECRET_KEY`: `openssl rand -hex 32`
- [ ] Replace all placeholder credentials (DB, Redis, SMTP, Slack) with strong values
- [ ] Set `DEBUG=False` and confirm the app exits on startup if required settings are missing
- [ ] Set your production domains in `ALLOWED_ORIGINS`
- [ ] Record secret rotation locations (vault/parameter store) for ongoing operations

### ✅ Step 2: Docker Production Config
- [ ] Create `docker-compose.prod.yml` alongside the dev compose file (template in checklist)
- [ ] Add `Dockerfile.frontend.prod` for the Vite build + Nginx runtime
- [ ] Update `Dockerfile.backend` for production (multi-stage build, non-root user, remove `--reload`)
- [ ] Add resource limits and restart policies for every service
- [ ] Drop development volume mounts and port exposures (DB/Redis should be internal-only)

### ✅ Step 3: Nginx Configuration
- [ ] Create `nginx/` directory
- [ ] Create `nginx/nginx.conf` (see checklist for template)
- [ ] Create `nginx/ssl/` directory for certificates
- [ ] Configure upstream servers
- [ ] Add security headers
- [ ] Enable gzip compression
- [ ] Configure `/api` and authenticated file-download routing (no direct `StaticFiles` exposure)

---

## Phase 2: Security (3-4 hours)

### ✅ Step 4: SSL/HTTPS Setup
- [ ] Install certbot: `sudo apt install certbot`
- [ ] Get certificate: `certbot certonly --standalone -d your-domain.com`
- [ ] Copy certificates to `nginx/ssl/`
- [ ] Configure nginx for HTTPS
- [ ] Test HTTPS redirect
- [ ] Setup auto-renewal

### ✅ Step 5: Security Hardening
- [ ] Remove seeded demo admin and implement secure bootstrap flow
- [ ] Store session tokens in HTTP-only cookies (update API + frontend)
- [ ] Gate file downloads behind authenticated endpoints / signed URLs
- [ ] Add rate limiting / lockout to login endpoint
- [ ] Enforce strong password policy + first-login rotation
- [ ] Close unnecessary ports (5432, 6379) and require Redis password
- [ ] Review CORS settings and verify security headers

### ✅ Step 6: Secrets Management
- [ ] All secrets in `.env` file
- [ ] `.env` in `.gitignore`
- [ ] No secrets in docker-compose files
- [ ] Set file permissions: `chmod 600 .env`
- [ ] Document secret rotation procedure

---

## Phase 3: Logging & Monitoring (3-4 hours)

### ✅ Step 7: Structured Logging
- [ ] Create `backend/logging_config.py` (see checklist)
- [ ] Add to `backend/main.py`
- [ ] Replace `print()` with `logger.info()`
- [ ] Add error logging
- [ ] Configure log rotation
- [ ] Create `logs/` directory

### ✅ Step 8: Error Handling
- [ ] Add global exception handler
- [ ] Add validation error handler
- [ ] Add database error handler
- [ ] Test error responses
- [ ] Verify errors are logged

### ✅ Step 9: Health Checks
- [ ] Add detailed health check endpoint
- [ ] Add readiness probe
- [ ] Add liveness probe
- [ ] Test health checks
- [ ] Configure nginx health check route

---

## Phase 4: Operations (3-4 hours)

### ✅ Step 10: Database Backups
- [ ] Create `scripts/` directory
- [ ] Create `scripts/backup_database.sh` (see checklist)
- [ ] Create `scripts/restore_database.sh` (see checklist)
- [ ] Make scripts executable: `chmod +x scripts/*.sh`
- [ ] Test backup manually
- [ ] Test restore manually
- [ ] Add to crontab: `0 2 * * *`

### ✅ Step 11: File Backups
- [ ] Create `scripts/backup_files.sh` (see checklist)
- [ ] Create backup directory: `mkdir -p backups/files`
- [ ] Test file backup
- [ ] Add to crontab: `0 3 * * *`
- [ ] Document restore procedure

### ✅ Step 12: Database Migrations
- [ ] Choose: Alembic or improve current approach
- [ ] If Alembic: Run `alembic init alembic`
- [ ] Configure migration scripts
- [ ] Test migration on dev database
- [ ] Document migration procedure

---

## Phase 5: Documentation (2-3 hours)

### ✅ Step 13: Deployment Guide
- [ ] Document server requirements
- [ ] Document installation steps
- [ ] Document configuration process
- [ ] Document SSL setup
- [ ] Document first-time initialization
- [ ] Document backup procedures

### ✅ Step 14: Operations Manual
- [ ] Document daily operations
- [ ] Document monitoring procedures
- [ ] Document backup verification
- [ ] Document update procedure
- [ ] Document rollback procedure

### ✅ Step 15: Troubleshooting Guide
- [ ] Document common issues
- [ ] Document log locations
- [ ] Document restart procedures
- [ ] Document health check usage
- [ ] Add contact information

---

## Phase 6: Testing (1-2 days)

### ✅ Step 16: Local Production Test
- [ ] Build production images
- [ ] Start production stack locally
- [ ] Test all features
- [ ] Test file uploads
- [ ] Test database operations
- [ ] Check logs
- [ ] Verify health checks

### ✅ Step 17: Security Testing
- [ ] Test HTTPS enforcement
- [ ] Test rate limiting
- [ ] Verify security headers
- [ ] Check for exposed ports
- [ ] Test authentication
- [ ] Try SQL injection
- [ ] Test file upload restrictions
- [ ] Confirm file downloads require valid session and expire appropriately
- [ ] Validate HTTP-only cookie auth cannot be retrieved via JS / inspect CSRF defenses

### ✅ Step 18: Performance Testing
- [ ] Run API load tests
- [ ] Test concurrent users
- [ ] Check response times
- [ ] Monitor resource usage
- [ ] Test database performance
- [ ] Verify caching

### ✅ Step 19: Backup Testing
- [ ] Run manual backup
- [ ] Verify backup file size
- [ ] Test restore procedure
- [ ] Verify data integrity
- [ ] Test automated backup
- [ ] Check backup retention

---

## Phase 7: Deployment (Day 7)

### ✅ Step 20: Server Preparation
- [ ] Ubuntu 22.04 LTS installed
- [ ] Docker installed
- [ ] Docker Compose installed
- [ ] Firewall configured (ports 80, 443)
- [ ] Domain DNS configured
- [ ] Create app directory: `/opt/monthend`

### ✅ Step 21: Code Deployment
- [ ] Clone repository
- [ ] Copy env.example to .env
- [ ] Update .env with production values
- [ ] Generate strong SECRET_KEY
- [ ] Set strong database password
- [ ] Configure domain settings

### ✅ Step 22: SSL Setup
- [ ] Install certbot
- [ ] Get SSL certificate
- [ ] Copy certificates to nginx/ssl/
- [ ] Test SSL configuration
- [ ] Verify auto-renewal

### ✅ Step 23: Application Start
- [ ] Build production images
- [ ] Start all services
- [ ] Check container status
- [ ] View logs for errors
- [ ] Test connectivity

### ✅ Step 24: Database Initialization
- [ ] Run the secure admin bootstrap command (to be provided with the new init script)
- [ ] Store the generated admin credentials securely and verify first-login password change
- [ ] Apply Alembic migrations against the production database
- [ ] (Optional for staging only) Load sample data scripts
- [ ] Verify database connectivity and role assignments

### ✅ Step 25: Backup Setup
- [ ] Create backup directories
- [ ] Test backup scripts
- [ ] Configure crontab
- [ ] Verify automated backups
- [ ] Document restore procedure

---

## Phase 8: Verification (Final Day)

### ✅ Step 26: Smoke Testing
- [ ] Access application URL
- [ ] Login with admin account
- [ ] Create a period
- [ ] Create a task
- [ ] Upload a file
- [ ] Download the file and confirm authorization is enforced
- [ ] Test trial balance import
- [ ] Check notifications
- [ ] Test all major features

### ✅ Step 27: Monitoring Setup
- [ ] Check health endpoint
- [ ] Verify logs are writing
- [ ] Test error reporting
- [ ] Configure alerts
- [ ] Setup uptime monitoring
- [ ] Document monitoring

### ✅ Step 28: Performance Verification
- [ ] Check page load times
- [ ] Test API response times
- [ ] Monitor resource usage
- [ ] Check database performance
- [ ] Verify caching works

### ✅ Step 29: Security Verification
- [ ] Verify HTTPS working
- [ ] Test rate limiting
- [ ] Check security headers
- [ ] Scan with security tools
- [ ] Review access logs
- [ ] Verify no exposed ports
- [ ] Inspect auth cookies for Secure/HttpOnly/SameSite flags

### ✅ Step 30: Final Checks
- [ ] All tests passing
- [ ] Documentation complete
- [ ] Backups working
- [ ] Monitoring active
- [ ] Team trained
- [ ] Support contacts ready

---

## 🚀 Go-Live Checklist

### Pre-Launch (T-1 hour)
- [ ] Final backup of dev database
- [ ] All code merged and tested
- [ ] Production .env reviewed
- [ ] SSL certificates valid
- [ ] Monitoring active
- [ ] Team on standby

### Launch (T=0)
- [ ] Start production services
- [ ] Verify all containers running
- [ ] Test health checks
- [ ] Test login
- [ ] Test key features
- [ ] Monitor logs

### Post-Launch (T+1 hour)
- [ ] Verify backups ran
- [ ] Check error logs
- [ ] Monitor performance
- [ ] Test notifications
- [ ] Verify SSL
- [ ] User acceptance testing

### Post-Launch (T+24 hours)
- [ ] Review error logs
- [ ] Check backup success
- [ ] Monitor resource usage
- [ ] Review security logs
- [ ] User feedback
- [ ] Document issues

---

## 🆘 Emergency Contacts

Before going live, fill in:

| Role | Name | Contact | Backup |
|------|------|---------|---------|
| **System Admin** | __________ | __________ | __________ |
| **Database Admin** | __________ | __________ | __________ |
| **Security Lead** | __________ | __________ | __________ |
| **On-Call Engineer** | __________ | __________ | __________ |
| **Hosting Provider** | __________ | __________ | N/A |

---

## 📊 Quick Command Reference

```bash
# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f backend

# Restart service
docker-compose -f docker-compose.prod.yml restart backend

# Run backup
/opt/monthend/scripts/backup_database.sh

# Check health
curl https://your-domain.com/api/health

# View recent logs
tail -f logs/app.log

# Check disk space
df -h

# Check memory
free -h

# Database backup
docker-compose exec backend python scripts/backup_database.sh

# Restore database
docker-compose exec backend python scripts/restore_database.sh /backups/file.sql.gz
```

---

## 📝 Notes Section

Use this space for deployment-specific notes:

```
Server IP: _______________
Domain: _______________
SSH Key: _______________
Admin Email: _______________
First Deployed: _______________
Last Updated: _______________

Special Configuration:
- 
- 
- 

Known Issues:
- 
- 
- 

TODO:
- 
- 
- 
```

---

## ✅ Sign-Off

**Deployment completed by:** _______________  
**Date:** _______________  
**Verified by:** _______________  
**Date:** _______________

**All critical items addressed:** [ ] Yes [ ] No  
**All tests passing:** [ ] Yes [ ] No  
**Documentation complete:** [ ] Yes [ ] No  
**Backups verified:** [ ] Yes [ ] No  
**Monitoring active:** [ ] Yes [ ] No

**Ready for production:** [ ] Yes [ ] No

---

## 📚 Reference Documents

1. `PRODUCTION_READINESS_CHECKLIST.md` - Detailed technical guide
2. `DEPLOYMENT_SUMMARY.md` - Executive overview
3. `README.md` - Application documentation
4. `env.example` - Environment configuration template

---

**Print this checklist and check off items as you complete them!**

Good luck with your deployment! 🚀





