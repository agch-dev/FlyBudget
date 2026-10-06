# Name default categories when reading, in the language of the request

A new budget is given its categories before any device has chosen an App Language, and one budget can be open on devices in different languages. So the name of a default category is not stored in a language: the server holds the app's list of supplied names in English and Spanish, stores the English spelling, and answers each request with the name in that request's language. A row is a default category exactly when its name is on that list; nothing else records it.

## Considered Options

- **Rename the stored rows when the user picks a language.** Names stay plain data. Rejected because it makes the language a property of the budget instead of the device, and because a bulk rename is a write two devices could each do differently.
- **Seed in the language of the first device.** No switching afterwards, and nothing for budgets that already exist.
- **Send a key and let the client name it.** The switch would be instant and work offline. Rejected because the server needs the names anyway for the transactions CSV, and because custom reports group by label, which is only right when one place resolves it.
- **A `default_key` column.** Rejected because being a default depends only on the name (a renamed category that gets a supplied name back is a default again), so a column could only ever disagree with it.

## Consequences

- The server learns the request's language, for two things only: naming default categories (and the "Overview" dashboard) and writing files. Its error text stays English; refusals carry codes that the client translates.
- A category the user names with a supplied name is a default category and reads in the other language on a device set to it. A user cannot keep a category literally called "Groceries" while the app is in Spanish.
- No Spanish name may equal a different entry's English name, or the list would be ambiguous. A test holds this.
- After a language switch the client refetches; names already on screen stay in the old language until the server answers.
