# Parser Integration Instructions

## Quick Integration (Using the Hook)

Add these 4 lines to your App.jsx:

```javascript
// 1. Import the hook (add with other imports)
import { useParserIntegration } from './hooks/useParserIntegration';

// 2. Inside your App component, add:
const { ParserButton, ParserModal } = useParserIntegration({
  onAssignmentsImported: (results) => {
    setAppData(prev => ({
      ...prev,
      assignments: [...prev.assignments, ...results.assignments],
      modules: [...prev.modules, ...(results.modules || [])]
    }));
  },
  isDark
});

// 3. In your header (near the dark mode button), add:
<ParserButton />

// 4. Before the closing </div> of your component, add:
<ParserModal />
```

## Manual Integration

If you prefer to integrate manually, see the code snippets in `scripts/manual-integration.js`

## Testing

1. Click the Upload button in your app header
2. Paste Canvas content or upload a file
3. Select the document type (or use auto-detect)
4. Click "Parse Content"
5. Check that assignments appear in your calendar

## Troubleshooting

- If the button doesn't appear, check that you added `<ParserButton />` in the header
- If the modal doesn't show, ensure you added `<ParserModal />` at the component end
- Check the browser console for any errors
