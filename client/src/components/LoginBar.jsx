import { useState } from 'react';
import { api } from '../api.js';

export default function LoginBar({ user, onLogin, onLogout }) {
  const [username, setUsername] = useState('officer1');
  const [password, setPassword] = useState('officer123');
  const [error, setError] = useState(null);

  if (user) {
    return (
      <div className="login-bar">
        <span>
          {user.name} <span className="role-badge">{user.role}</span>
        </span>
        <button onClick={onLogout}>Log out</button>
      </div>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const { token, user: u } = await api.login(username, password);
      onLogin(u, token);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="login-bar" onSubmit={submit}>
      <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" />
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="password"
        type="password"
      />
      <button type="submit">Log in</button>
      {error && <span className="error">{error}</span>}
    </form>
  );
}
