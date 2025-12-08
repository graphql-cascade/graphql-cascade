/**
 * TodoItem Component
 *
 * Displays a single todo with update and delete actions.
 * Demonstrates how Cascade keeps the UI in sync automatically.
 */

import React, { useState } from 'react';
import { useUpdateTodo, useDeleteTodo, useToggleTodo } from '../hooks/useTodoMutations';
import { Todo } from '../types';

interface TodoItemProps {
  todo: Todo;
}

const TodoItem: React.FC<TodoItemProps> = ({ todo }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(todo.title);

  const toggleTodo = useToggleTodo();
  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();

  const handleToggle = () => {
    toggleTodo.mutate({ id: todo.id, completed: todo.completed });
  };

  const handleEdit = () => {
    setIsEditing(true);
    setEditTitle(todo.title);
  };

  const handleSave = () => {
    if (editTitle.trim() && editTitle !== todo.title) {
      updateTodo.mutate(
        { id: todo.id, input: { title: editTitle.trim() } },
        {
          onSuccess: () => setIsEditing(false),
        }
      );
    } else {
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditTitle(todo.title);
  };

  const handleDelete = () => {
    if (window.confirm('Are you sure you want to delete this todo?')) {
      deleteTodo.mutate(todo.id);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <div className={`todo-item ${todo.completed ? 'completed' : ''}`}>
      <div className="todo-content">
        <input
          type="checkbox"
          checked={todo.completed}
          onChange={handleToggle}
          disabled={toggleTodo.isPending}
          className="todo-checkbox"
        />

        {isEditing ? (
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleSave}
            autoFocus
            className="todo-edit-input"
          />
        ) : (
          <span className="todo-title" onDoubleClick={handleEdit}>
            {todo.title}
          </span>
        )}
      </div>

      <div className="todo-actions">
        {!isEditing && (
          <>
            <button
              onClick={handleEdit}
              disabled={updateTodo.isPending}
              className="btn-edit"
              title="Edit todo"
            >
              Edit
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteTodo.isPending}
              className="btn-delete"
              title="Delete todo"
            >
              {deleteTodo.isPending ? 'Deleting...' : 'Delete'}
            </button>
          </>
        )}
      </div>

      {updateTodo.isPending && (
        <div className="update-indicator">Saving...</div>
      )}

      <div className="todo-meta">
        <span className="meta-item">
          Updated: {new Date(todo.updatedAt).toLocaleString()}
        </span>
      </div>
    </div>
  );
};

export default TodoItem;
