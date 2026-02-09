Presentation module

This module provides a small `presentationManager` that holds UI presentation state and helpers.

API:

- `construct()` - create a manager instance
- `presentation` - singleton instance

Methods:

- `start(profile?)`, `stop()`, `toggleTestMode()`, `setProfile()`

Use it from components or layout to switch presentation/test modes or to drive presentation-specific UI.
