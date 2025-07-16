# Page snapshot

```yaml
- main:
  - text: Welcome to Budget Planner
  - paragraph: Sign in to your account or create a new one to get started
  - tablist:
    - tab "Login" [selected]
    - tab "Register"
  - tabpanel "Login":
    - text: Email
    - textbox "Email"
    - text: Password
    - textbox "Password"
    - button "Sign In"
- region "Notifications (F8)":
  - list
- alert
```