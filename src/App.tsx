import { useEffect, useState } from 'react';

const CLIENT_ID = import.meta.env.VITE_CLIENT_ID!;
const API_KEY = import.meta.env.VITE_API_KEY!;
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const SCOPES = 'https://www.googleapis.com/auth/calendar.readonly';

declare global {
    interface Window {
        gapi: any;
        google: any;
    }
}

function App() {
    const [tokenClient, setTokenClient] = useState<any>(null);
    const [gapiInited, setGapiInited] = useState(false);
    const [gisInited, setGisInited] = useState(false);
    const [authorized, setAuthorized] = useState(false);
    const [events, setEvents] = useState<string>('');

    // Load external scripts
    useEffect(() => {
        const loadScript = (src: string, onload?: () => void) => {
            const script = document.createElement('script');
            script.src = src;
            script.async = true;
            script.defer = true;
            if (onload) script.onload = onload;
            document.body.appendChild(script);
        };

        const gapiLoaded = () => {
            window.gapi.load('client', async () => {
                await window.gapi.client.init({
                    apiKey: API_KEY,
                    discoveryDocs: [DISCOVERY_DOC],
                });
                setGapiInited(true);

                const savedToken = localStorage.getItem('access_token');
                if (savedToken) {
                    const tokenObj = JSON.parse(savedToken);
                    window.gapi.client.setToken(tokenObj);
                    setAuthorized(true);
                    listEvents(); // авто-загрузка при восстановлении токена
                }
            });
        };

        const gisLoaded = () => {
            const client = window.google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                callback: '', // будет установлен при авторизации
            });
            setTokenClient(client);
            setGisInited(true);
        };

        loadScript('https://apis.google.com/js/api.js', gapiLoaded);
        loadScript('https://accounts.google.com/gsi/client', gisLoaded);
    }, []);

    // Авторизация
    const handleAuthClick = () => {
        if (!tokenClient) return;

        tokenClient.callback = async (resp: any) => {
            if (resp.error) {
                console.error(resp);
                return;
            }

            const token = window.gapi.client.getToken();
            localStorage.setItem('access_token', JSON.stringify(token));
            setAuthorized(true);
            await listEvents();
        };

        const currentToken = window.gapi.client.getToken();
        if (!currentToken) {
            tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
            tokenClient.requestAccessToken({ prompt: '' });
        }
    };

    // Выход
    const handleSignoutClick = () => {
        const token = window.gapi.client.getToken();
        if (token) {
            window.google.accounts.oauth2.revoke(token.access_token);
            window.gapi.client.setToken(null);
            localStorage.removeItem('access_token');
            setAuthorized(false);
            setEvents('');
        }
    };

    // Получение событий
    const listEvents = async () => {
        try {
            const response = await window.gapi.client.calendar.events.list({
                calendarId: 'primary',
                timeMin: new Date().toISOString(),
                showDeleted: false,
                singleEvents: true,
                maxResults: 10,
                orderBy: 'startTime',
            });

            const items = response.result.items;
            if (!items || items.length === 0) {
                setEvents('No events found.');
                return;
            }

            const result = items
                .map((event: any) => `${event.summary} (${event.start.dateTime || event.start.date})`)
                .join('\n');

            setEvents(result);
        } catch (err: any) {
            console.error(err);
            setEvents('Ошибка при получении событий.');
        }
    };

    return (
        <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
            <h1>Google Calendar API Quickstart</h1>
            {!authorized ? (
                <button onClick={handleAuthClick} disabled={!gapiInited || !gisInited}>
                    Authorize
                </button>
            ) : (
                <button onClick={handleSignoutClick}>Sign Out</button>
            )}
            <pre style={{ whiteSpace: 'pre-wrap', marginTop: '1rem' }}>{events}</pre>
        </div>
    );
}

export default App;
