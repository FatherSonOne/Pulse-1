/**
 * API Documentation Component
 * Interactive documentation for the Pulse Public API
 */

import React, { useState } from 'react';
import './ApiDocumentation.css';

interface Endpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  summary: string;
  description: string;
  scope: 'read' | 'write' | 'delete' | 'admin';
  parameters?: Parameter[];
  requestBody?: {
    description: string;
    required: boolean;
    content: Record<string, any>;
  };
  responses: Record<string, ResponseSpec>;
}

interface Parameter {
  name: string;
  in: 'path' | 'query' | 'header';
  description: string;
  required: boolean;
  type: string;
}

interface ResponseSpec {
  description: string;
  content?: Record<string, any>;
}

const API_BASE = 'https://pulse.logosvision.org/api/v1';

const endpoints: Endpoint[] = [
  {
    method: 'GET',
    path: '/me',
    summary: 'Get API Key Info',
    description: 'Returns information about the current API key being used.',
    scope: 'read',
    responses: {
      '200': {
        description: 'Success',
        content: {
          name: 'Production App',
          scopes: ['read', 'write'],
          rate_limit: 100,
          last_used_at: '2024-01-10T12:00:00Z',
          created_at: '2024-01-01T00:00:00Z'
        }
      }
    }
  },
  {
    method: 'GET',
    path: '/projects',
    summary: 'List Projects',
    description: 'Returns a list of all projects owned by the authenticated user.',
    scope: 'read',
    responses: {
      '200': {
        description: 'Success',
        content: {
          success: true,
          data: [
            {
              id: 'uuid-1234',
              name: 'My Research Project',
              description: 'A project for AI research',
              icon: 'folder',
              color: '#f43f5e',
              is_shared: false,
              created_at: '2024-01-01T00:00:00Z',
              updated_at: '2024-01-10T12:00:00Z'
            }
          ]
        }
      }
    }
  },
  {
    method: 'POST',
    path: '/projects',
    summary: 'Create Project',
    description: 'Creates a new project.',
    scope: 'write',
    requestBody: {
      description: 'Project details',
      required: true,
      content: {
        name: 'New Project',
        description: 'Project description (optional)',
        icon: 'folder',
        color: '#f43f5e'
      }
    },
    responses: {
      '201': {
        description: 'Project created',
        content: {
          success: true,
          data: {
            id: 'uuid-5678',
            name: 'New Project',
            description: 'Project description',
            icon: 'folder',
            color: '#f43f5e',
            created_at: '2024-01-10T12:00:00Z'
          }
        }
      }
    }
  },
  {
    method: 'GET',
    path: '/projects/:id',
    summary: 'Get Project',
    description: 'Returns details for a specific project.',
    scope: 'read',
    parameters: [
      {
        name: 'id',
        in: 'path',
        description: 'Project UUID',
        required: true,
        type: 'string (UUID)'
      }
    ],
    responses: {
      '200': {
        description: 'Success',
        content: {
          success: true,
          data: {
            id: 'uuid-1234',
            name: 'My Project',
            description: 'Full project details...'
          }
        }
      },
      '404': {
        description: 'Project not found'
      }
    }
  },
  {
    method: 'GET',
    path: '/projects/:id/documents',
    summary: 'List Documents',
    description: 'Returns all documents in a project.',
    scope: 'read',
    parameters: [
      {
        name: 'id',
        in: 'path',
        description: 'Project UUID',
        required: true,
        type: 'string (UUID)'
      }
    ],
    responses: {
      '200': {
        description: 'Success',
        content: {
          success: true,
          data: [
            {
              id: 'doc-uuid',
              title: 'Research Notes',
              source_type: 'text',
              source_url: null,
              text_content: 'Document content...',
              created_at: '2024-01-05T10:00:00Z'
            }
          ]
        }
      }
    }
  },
  {
    method: 'POST',
    path: '/projects/:id/documents',
    summary: 'Add Document',
    description: 'Adds a new document to a project. The document content will be available for RAG queries.',
    scope: 'write',
    parameters: [
      {
        name: 'id',
        in: 'path',
        description: 'Project UUID',
        required: true,
        type: 'string (UUID)'
      }
    ],
    requestBody: {
      description: 'Document content',
      required: true,
      content: {
        title: 'Document Title',
        content: 'The full text content of the document...',
        source_type: 'text | url | file',
        source_url: 'https://example.com/article (optional)'
      }
    },
    responses: {
      '201': {
        description: 'Document created',
        content: {
          success: true,
          data: {
            id: 'doc-uuid',
            title: 'Document Title',
            source_type: 'text',
            created_at: '2024-01-10T12:00:00Z'
          }
        }
      }
    }
  },
  {
    method: 'POST',
    path: '/projects/:id/chat',
    summary: 'Chat with Project AI',
    description: 'Send a message to the project AI. The AI uses RAG to answer questions based on the project\'s documents.',
    scope: 'write',
    parameters: [
      {
        name: 'id',
        in: 'path',
        description: 'Project UUID',
        required: true,
        type: 'string (UUID)'
      }
    ],
    requestBody: {
      description: 'Chat message',
      required: true,
      content: {
        message: 'What are the key findings in the research documents?',
        session_id: 'session-uuid (optional, to continue a conversation)'
      }
    },
    responses: {
      '200': {
        description: 'AI response',
        content: {
          success: true,
          data: {
            session_id: 'session-uuid',
            message: 'Based on your documents, the key findings are...',
            created_at: '2024-01-10T12:00:00Z'
          }
        }
      }
    }
  },
  {
    method: 'GET',
    path: '/messages',
    summary: 'List Messages',
    description: 'Returns chat messages with optional filtering.',
    scope: 'read',
    parameters: [
      {
        name: 'session_id',
        in: 'query',
        description: 'Filter by session UUID',
        required: false,
        type: 'string (UUID)'
      },
      {
        name: 'limit',
        in: 'query',
        description: 'Max results (default 50, max 100)',
        required: false,
        type: 'integer'
      }
    ],
    responses: {
      '200': {
        description: 'Success',
        content: {
          success: true,
          data: [
            {
              id: 'msg-uuid',
              session_id: 'session-uuid',
              role: 'user | assistant',
              content: 'Message content...',
              created_at: '2024-01-10T12:00:00Z'
            }
          ]
        }
      }
    }
  },
  {
    method: 'POST',
    path: '/capture',
    summary: 'Quick Capture',
    description: 'Quickly capture content (used by browser extension). Creates a document in the default or specified project.',
    scope: 'write',
    requestBody: {
      description: 'Capture content',
      required: true,
      content: {
        content: 'The content to capture',
        title: 'Capture title (optional)',
        url: 'https://source-url.com (optional)',
        type: 'text | selection | article | page',
        project_id: 'uuid (optional, uses default if not specified)'
      }
    },
    responses: {
      '201': {
        description: 'Content captured',
        content: {
          success: true,
          data: {
            id: 'doc-uuid',
            project_id: 'project-uuid',
            title: 'Capture title',
            created_at: '2024-01-10T12:00:00Z'
          }
        }
      }
    }
  }
];

export const ApiDocumentation: React.FC = () => {
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);
  const [selectedSection, setSelectedSection] = useState<'overview' | 'auth' | 'endpoints' | 'errors'>('overview');

  const toggleEndpoint = (key: string) => {
    setExpandedEndpoint(expandedEndpoint === key ? null : key);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
  };

  return (
    <div className="api-docs">
      <div className="api-docs-sidebar">
        <nav>
          <button
            className={selectedSection === 'overview' ? 'active' : ''}
            onClick={() => setSelectedSection('overview')}
          >
            Overview
          </button>
          <button
            className={selectedSection === 'auth' ? 'active' : ''}
            onClick={() => setSelectedSection('auth')}
          >
            Authentication
          </button>
          <button
            className={selectedSection === 'endpoints' ? 'active' : ''}
            onClick={() => setSelectedSection('endpoints')}
          >
            Endpoints
          </button>
          <button
            className={selectedSection === 'errors' ? 'active' : ''}
            onClick={() => setSelectedSection('errors')}
          >
            Errors
          </button>
        </nav>
      </div>

      <div className="api-docs-content">
        {selectedSection === 'overview' && (
          <section className="docs-section">
            <h1>Pulse API</h1>
            <p className="lead">
              The Pulse API provides programmatic access to your projects, documents, and AI chat features.
              Use it to build integrations, automate workflows, or extend Pulse functionality.
            </p>

            <h2>Base URL</h2>
            <div className="code-block">
              <code>{API_BASE}</code>
              <button onClick={() => copyCode(API_BASE)}>Copy</button>
            </div>

            <h2>Quick Start</h2>
            <ol className="numbered-list">
              <li>Create an API key in Settings &gt; API Keys</li>
              <li>Copy your key (it's only shown once!)</li>
              <li>Include it in the <code>Authorization</code> header</li>
              <li>Make requests to the API endpoints</li>
            </ol>

            <div className="code-block">
              <pre>{`curl -X GET "${API_BASE}/projects" \\
  -H "Authorization: Bearer pk_live_your_api_key_here" \\
  -H "Content-Type: application/json"`}</pre>
              <button onClick={() => copyCode(`curl -X GET "${API_BASE}/projects" \\\n  -H "Authorization: Bearer pk_live_your_api_key_here" \\\n  -H "Content-Type: application/json"`)}>Copy</button>
            </div>

            <h2>Rate Limiting</h2>
            <p>
              API requests are rate limited per API key. The default limit is 100 requests per minute.
              Rate limit headers are included in all responses:
            </p>
            <ul>
              <li><code>X-RateLimit-Limit</code>: Maximum requests per minute</li>
              <li><code>X-RateLimit-Remaining</code>: Remaining requests in current window</li>
              <li><code>X-RateLimit-Reset</code>: Unix timestamp when the limit resets</li>
            </ul>
          </section>
        )}

        {selectedSection === 'auth' && (
          <section className="docs-section">
            <h1>Authentication</h1>
            <p className="lead">
              All API requests must include a valid API key for authentication.
            </p>

            <h2>API Key Authentication</h2>
            <p>
              Include your API key in the <code>Authorization</code> header using the Bearer scheme:
            </p>
            <div className="code-block">
              <code>Authorization: Bearer pk_live_xxxxxxxxxxxxx</code>
            </div>

            <p>Alternatively, you can use the <code>X-API-Key</code> header:</p>
            <div className="code-block">
              <code>X-API-Key: pk_live_xxxxxxxxxxxxx</code>
            </div>

            <h2>API Key Scopes</h2>
            <p>API keys can have different permission scopes:</p>
            <table className="scopes-table">
              <thead>
                <tr>
                  <th>Scope</th>
                  <th>Permissions</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>read</code></td>
                  <td>Read access to projects, documents, and messages</td>
                </tr>
                <tr>
                  <td><code>write</code></td>
                  <td>Create and update projects, documents, and messages</td>
                </tr>
                <tr>
                  <td><code>delete</code></td>
                  <td>Delete projects and documents</td>
                </tr>
                <tr>
                  <td><code>admin</code></td>
                  <td>Full access to all operations</td>
                </tr>
              </tbody>
            </table>

            <h2>Security Best Practices</h2>
            <ul>
              <li>Never expose API keys in client-side code or public repositories</li>
              <li>Use environment variables to store API keys</li>
              <li>Rotate keys regularly and revoke unused keys</li>
              <li>Use the minimum scope needed for your integration</li>
              <li>Set expiration dates for temporary integrations</li>
            </ul>
          </section>
        )}

        {selectedSection === 'endpoints' && (
          <section className="docs-section">
            <h1>API Endpoints</h1>
            <p className="lead">
              All endpoints return JSON responses with a <code>success</code> field and either a <code>data</code> or <code>error</code> field.
            </p>

            <div className="endpoints-list">
              {endpoints.map((endpoint, index) => {
                const key = `${endpoint.method}-${endpoint.path}`;
                const isExpanded = expandedEndpoint === key;

                return (
                  <div key={index} className={`endpoint-item ${isExpanded ? 'expanded' : ''}`}>
                    <button
                      className="endpoint-header"
                      onClick={() => toggleEndpoint(key)}
                    >
                      <span className={`method method-${endpoint.method.toLowerCase()}`}>
                        {endpoint.method}
                      </span>
                      <span className="path">{endpoint.path}</span>
                      <span className="summary">{endpoint.summary}</span>
                      <span className={`scope scope-${endpoint.scope}`}>{endpoint.scope}</span>
                      <svg
                        className={`chevron ${isExpanded ? 'expanded' : ''}`}
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>

                    {isExpanded && (
                      <div className="endpoint-details">
                        <p className="description">{endpoint.description}</p>

                        {endpoint.parameters && endpoint.parameters.length > 0 && (
                          <div className="endpoint-section">
                            <h4>Parameters</h4>
                            <table>
                              <thead>
                                <tr>
                                  <th>Name</th>
                                  <th>In</th>
                                  <th>Type</th>
                                  <th>Required</th>
                                  <th>Description</th>
                                </tr>
                              </thead>
                              <tbody>
                                {endpoint.parameters.map((param, i) => (
                                  <tr key={i}>
                                    <td><code>{param.name}</code></td>
                                    <td>{param.in}</td>
                                    <td>{param.type}</td>
                                    <td>{param.required ? 'Yes' : 'No'}</td>
                                    <td>{param.description}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {endpoint.requestBody && (
                          <div className="endpoint-section">
                            <h4>Request Body</h4>
                            <p>{endpoint.requestBody.description}</p>
                            <div className="code-block">
                              <pre>{JSON.stringify(endpoint.requestBody.content, null, 2)}</pre>
                            </div>
                          </div>
                        )}

                        <div className="endpoint-section">
                          <h4>Responses</h4>
                          {Object.entries(endpoint.responses).map(([code, response]) => (
                            <div key={code} className="response-item">
                              <span className={`status-code status-${code[0]}`}>{code}</span>
                              <span className="response-desc">{response.description}</span>
                              {response.content && (
                                <div className="code-block">
                                  <pre>{JSON.stringify(response.content, null, 2)}</pre>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {selectedSection === 'errors' && (
          <section className="docs-section">
            <h1>Error Handling</h1>
            <p className="lead">
              The API uses standard HTTP status codes to indicate success or failure.
              Error responses include a descriptive message.
            </p>

            <h2>Error Response Format</h2>
            <div className="code-block">
              <pre>{JSON.stringify({
                success: false,
                error: 'Description of what went wrong'
              }, null, 2)}</pre>
            </div>

            <h2>Status Codes</h2>
            <table className="error-codes-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Meaning</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><code>200</code></td>
                  <td>OK</td>
                  <td>Request succeeded</td>
                </tr>
                <tr>
                  <td><code>201</code></td>
                  <td>Created</td>
                  <td>Resource was created successfully</td>
                </tr>
                <tr>
                  <td><code>400</code></td>
                  <td>Bad Request</td>
                  <td>Invalid request parameters or body</td>
                </tr>
                <tr>
                  <td><code>401</code></td>
                  <td>Unauthorized</td>
                  <td>Missing or invalid API key</td>
                </tr>
                <tr>
                  <td><code>403</code></td>
                  <td>Forbidden</td>
                  <td>API key lacks required scope</td>
                </tr>
                <tr>
                  <td><code>404</code></td>
                  <td>Not Found</td>
                  <td>Requested resource doesn't exist</td>
                </tr>
                <tr>
                  <td><code>429</code></td>
                  <td>Too Many Requests</td>
                  <td>Rate limit exceeded</td>
                </tr>
                <tr>
                  <td><code>500</code></td>
                  <td>Internal Error</td>
                  <td>Something went wrong on our end</td>
                </tr>
              </tbody>
            </table>

            <h2>Common Error Messages</h2>
            <ul>
              <li><code>"Missing or invalid API key"</code> - Include a valid API key in the Authorization header</li>
              <li><code>"Invalid or expired API key"</code> - Your API key may have been revoked or expired</li>
              <li><code>"Insufficient permissions"</code> - Your API key lacks the required scope for this operation</li>
              <li><code>"Rate limit exceeded"</code> - Wait and retry, or upgrade your rate limit</li>
              <li><code>"Project not found"</code> - The specified project doesn't exist or you don't have access</li>
            </ul>
          </section>
        )}
      </div>
    </div>
  );
};

export default ApiDocumentation;
