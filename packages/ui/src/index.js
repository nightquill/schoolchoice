// @schoolchoice/ui — barrel export
// Components, primitives, context, hooks, and API client

// Components
export { default as ActionBar } from './components/ActionBar/ActionBar';
export { default as Button } from './components/Button/Button';
export { default as ColumnMapper } from './components/ColumnMapper/ColumnMapper';
export { default as ConfidenceBadge } from './components/ConfidenceBadge/ConfidenceBadge';
export { default as EligibilityBadge } from './components/EligibilityBadge/EligibilityBadge';
export { default as EmptyState } from './components/EmptyState/EmptyState';
export { default as ErrorMessage } from './components/ErrorMessage/ErrorMessage';
export { default as FileUpload } from './components/FileUpload/FileUpload';
export { default as FilterControl } from './components/FilterControl/FilterControl';
export { default as FormCard } from './components/FormCard/FormCard';
export { default as LoadingSpinner } from './components/LoadingSpinner/LoadingSpinner';
export { default as Modal } from './components/Modal/Modal';
export { default as NavBar } from './components/NavBar/NavBar';
export { default as PredictedGradeBadge } from './components/PredictedGradeBadge/PredictedGradeBadge';
export { default as QueryBoundary } from './components/QueryBoundary/QueryBoundary';
export { default as SearchFilterBar } from './components/SearchFilterBar/SearchFilterBar';
export { default as StarRating } from './components/StarRating/StarRating';
export { default as StatusChip } from './components/StatusChip/StatusChip';
export { default as Tabs } from './components/Tabs/Tabs';
export { default as TemplateSelector } from './components/TemplateSelector/TemplateSelector';
export { default as TextInput } from './components/TextInput/TextInput';
export { default as Toast } from './components/Toast/Toast';

// Context
export { AuthContext, AuthProvider } from './context/AuthContext';

// Hooks
export { useAuth } from './hooks/useAuth';
export { useToast } from './hooks/useToast';

// API client
export { default as apiClient } from './api/client';
export { login, register } from './api/auth';
export { getAccount, updateAccount, changePassword, deleteAccount } from './api/account';

// Lib
export { cn } from './lib/utils';
