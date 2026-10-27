# Deleting accounts and leftover data

Firebase Authentication and Firestore aren't linked: deleting a user in the
Authentication console leaves their data in Firestore.

## Users delete their own account

Settings menu → **Delete account**. The user types their email and signs in
again (Google popup, or their password). `DELETE /api/account` then deletes
`users/{uid}` with everything under it, their `agentUsage` and `agentWaitlist`
docs, and finally the Auth user. The server refuses a sign-in older than five
minutes, so a leaked session token can't delete an account.

## Cleaning up after console deletions

`/api/cleanup-orphans` finds uids that have data but no Auth user. It needs
`CRON_SECRET` (the same one the reminders sender uses).

See what would be deleted (changes nothing):

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://oplanner-one.vercel.app/api/cleanup-orphans
```

Delete it (up to 25 users per call; repeat while `remaining` is above 0):

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://oplanner-one.vercel.app/api/cleanup-orphans
```
