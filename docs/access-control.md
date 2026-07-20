# Access control policy

Every non-public endpoint requires a valid JWT. The server resolves the active
company and membership role from the authenticated user; clients never supply a
tenant ID for resource access.

| Action | Owner | Admin | Member |
| --- | :---: | :---: | :---: |
| View projects and tasks in active company | Yes | Yes | Yes |
| Create, edit, archive projects | Yes | Yes | No |
| Create, edit, delete any task | Yes | Yes | No |
| Update an assigned task | Yes | Yes | Only own task |
| Invite, remove, or change member roles | Yes | Yes | No |

`owner` has all admin permissions. Routes restricted to roles use, for example:

```ts
@RequireTenant()
@Roles('owner', 'admin')
```

For a member task update, the service must query the task inside
`PrismaService.withTenant()` and require `task.assigneeId === request.user.id`.
That check is resource-level authorization and cannot safely be replaced by a
role-only guard.
