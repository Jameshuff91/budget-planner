# Page snapshot

```yaml
- region "Notifications (F8)":
  - list
- dialog "Edit Transaction":
  - heading "Edit Transaction" [level=2]
  - paragraph: Make changes to the transaction details below.
  - text: Date
  - textbox "Date"
  - text: Description
  - textbox "Description": Grocery Store
  - text: Amount
  - spinbutton "Amount": "50.25"
  - text: Type
  - combobox: Expense
  - text: Category
  - combobox: Uncategorized
  - button "Cancel"
  - button "Save changes"
  - button "Close":
    - img
    - text: Close
```