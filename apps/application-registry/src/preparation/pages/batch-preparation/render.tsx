import { Navigate } from 'react-router'

/** Compatibility entrypoint for bookmarks created before the workflow hub. */
export const BatchPreparationPage = () => <Navigate to="/workflows" replace />
