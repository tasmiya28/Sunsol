import { useState, useEffect } from "react";

export default function ErrorBoundary({ children }) {
    const [error, setError] = useState(null);

    useEffect(() => {
        const handleError = (event) => {
            console.error("Error caught:", event.error);
            setError(event.error?.message || "An unexpected error occurred");
        };

        window.addEventListener("error", handleError);
        return () => window.removeEventListener("error", handleError);
    }, []);

    if (error) {
        return (
            <div style={{ padding: "2rem", textAlign: "center" }}>
                <h2 style={{ color: "var(--red)", marginBottom: "1rem" }}>⚠️ Error</h2>
                <p style={{ color: "var(--text2)", marginBottom: "1rem" }}>{error}</p>
                <button
                    className="btn btn-solar"
                    onClick={() => {
                        setError(null);
                        window.location.reload();
                    }}
                >
                    Reload Page
                </button>
            </div>
        );
    }

    return children;
}
