import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LoginCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      // Exchange code for token
      fetch(`http://localhost:8000/auth/callback?code=${code}`)
        .then(res => res.json())
        .then(data => {
          if (data.access_token) {
            login(data.access_token, data.user);
            navigate('/');
          }
        })
        .catch(err => {
          console.error('Failed to login:', err);
          navigate('/');
        });
    } else {
      navigate('/');
    }
  }, [searchParams, login, navigate]);

  return (
    <div className="flex items-center justify-center h-screen bg-gray-950 text-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto mb-4"></div>
        <p className="text-lg font-bold">Authenticating with Discord...</p>
      </div>
    </div>
  );
};

export default LoginCallback;
