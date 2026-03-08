import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LoginCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    const username = searchParams.get('username');
    const role = searchParams.get('role');
    const discord_id = searchParams.get('discord_id');

    if (token && username && role && discord_id) {
      login(token, {
        username,
        role,
        discord_id
      });
      navigate('/');
    } else {
      // Fallback: If for some reason we got here without params, just go home
      console.warn("Login callback reached without user data");
      navigate('/');
    }
  }, [searchParams, login, navigate]);

  return (
    <div className="flex items-center justify-center h-screen bg-gray-950 text-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto mb-4"></div>
        <p className="text-lg font-bold">Resuming Session...</p>
      </div>
    </div>
  );
};

export default LoginCallback;
