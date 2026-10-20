import React, { useState, useEffect } from "react";
import { saveProfile, getRecommendations, api, tokenStore } from "../api";

export function PhysicalModelTester() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [statusMsg, setStatusMsg] = useState("");
    const [isLoggedIn, setIsLoggedIn] = useState(!!tokenStore.get());

    const [profile, setProfile] = useState({
        goal: "fitness",
        activity_level: "medium",
        available_minutes: 30,
        equipment: ["dumbbells"],
        diet_pref: "sri_lankan",
        sleep_hours: 6.5,
        workload_intensity_score: 65,
        stress_score: 7,
        burnout_score: 5,
        bmi: 23.5,
        physical_limitations: "none",
    });

    const [isExamPeriod, setIsExamPeriod] = useState(false);
    const [useBaseline, setUseBaseline] = useState(false);
    const [recommendations, setRecommendations] = useState(null);

    const handleInputChange = (field, value) => {
        setProfile((prev) => ({ ...prev, [field]: value }));
    };

    const handleEquipmentToggle = (item) => {
        setProfile((prev) => {
            const exists = prev.equipment.includes(item);
            const updated = exists
                ? prev.equipment.filter((i) => i !== item)
                : [...prev.equipment, item];
            return { ...prev, equipment: updated };
        });
    };

    const handleDemoLogin = async () => {
        setLoading(true);
        setError("");
        setStatusMsg("Registering/Logging in test student account...");
        const testEmail = "demo_student@ihusd.edu";
        const testPassword = "password123";

        try {
            // Try to register test user
            try {
                await api.post("/auth/register", {
                    email: testEmail,
                    password: testPassword,
                    full_name: "Demo Student",
                    university: "SLIIT",
                    year_of_study: 3,
                    research_consent: true,
                });
            } catch (regErr) {
                // Ignore if account already exists
            }

            // Login to get OAuth JWT Token
            const formData = new FormData();
            formData.append("username", testEmail);
            formData.append("password", testPassword);
            const loginRes = await api.post("/auth/login", formData);

            tokenStore.set(loginRes.data.access_token, true);
            setIsLoggedIn(true);
            setStatusMsg("✅ Auto-login successful! You can now test the live ML model.");
            await runModel();
        } catch (err) {
            console.error(err);
            setError("Failed to auto-login. Please ensure FastAPI server is running on port 8000.");
        } finally {
            setLoading(false);
        }
    };

    const runModel = async () => {
        setLoading(true);
        setError("");
        setStatusMsg("");

        try {
            if (!tokenStore.get()) {
                await handleDemoLogin();
                return;
            }

            // 1. Save profile to backend
            await saveProfile(profile);
            // 2. Fetch live recommendations from FastAPI ML model
            const res = await getRecommendations(isExamPeriod, useBaseline);
            setRecommendations(res);
            setStatusMsg("✅ Live recommendations retrieved from FastAPI XGBoost engine!");
        } catch (err) {
            console.error(err);
            if (err.response?.status === 401) {
                tokenStore.clear();
                setIsLoggedIn(false);
                setError("Session expired or unauthorized. Click 'Quick Demo Login' below.");
            } else {
                setError(
                    err.response?.data?.detail ||
                    "Cannot connect to FastAPI backend at http://localhost:8000. Please start your backend server using '.\\.venv\\Scripts\\uvicorn app.main:app --reload'."
                );
                // Offline Fallback preview
                generateOfflineFallback();
            }
        } finally {
            setLoading(false);
        }
    };

    const generateOfflineFallback = () => {
        // Local offline mock generation if server is stopped
        const durationCut = isExamPeriod ? 0.5 : 1.0;
        const availTime = Math.round(profile.available_minutes * durationCut);
        const hasKneePain = profile.physical_limitations === "knee_pain";

        const offlineWorkouts = [
            {
                name: isExamPeriod ? "Exam-De-Stress Express Yoga" : "Full Body Conditioning",
                duration_mins: availTime,
                muscle: "Full Body",
                intensity: profile.stress_score > 7 ? "Low" : "Medium",
                limitation_safe: true,
                description: isExamPeriod
                    ? "Short posture correction & deep breathing during exam season."
                    : "Balanced mobility and strength work.",
            },
            {
                name: hasKneePain ? "Seated Core & Arm Toning" : "Bodyweight Squats & Core",
                duration_mins: Math.max(10, Math.round(availTime * 0.7)),
                muscle: hasKneePain ? "Upper Body / Core" : "Legs / Core",
                intensity: "Medium",
                limitation_safe: true,
                description: hasKneePain
                    ? "Low-impact upper body exercise safe for knee joint recovery."
                    : "Standard bodyweight lower body exercise.",
            },
        ];

        const offlineMeals = [
            {
                name: "Sri Lankan Red Rice, Dhal Curry & Pol Sambol",
                cuisine: "Sri Lankan",
                calories: 420,
                protein: 14,
                prep_time_mins: 15,
            },
            {
                name: "Gotukola Sambol & Steamed Fish Filet",
                cuisine: "Sri Lankan",
                calories: 380,
                protein: 28,
                prep_time_mins: 20,
            },
        ];

        setRecommendations({
            model_version: useBaseline ? "1.0-RuleBased-Offline" : "2.0-XGBoost-OfflinePreview",
            context_aware: true,
            recovery_mode: profile.stress_score >= 8,
            recommended_workouts: offlineWorkouts,
            recommended_meals: offlineMeals,
        });
    };

    useEffect(() => {
        if (isLoggedIn) {
            runModel();
        }
    }, [isExamPeriod, useBaseline]);

    return (
        <div style={styles.container}>
            <header style={styles.header}>
                <div>
                    <span style={styles.badge}>ML MODEL LAB</span>
                    <h1 style={styles.title}>Physical Wellbeing AI Model Tester</h1>
                    <p style={styles.subtitle}>
                        Test your adaptive XGBoost recommendation engine live under varying student workloads, stress, & physical limitations.
                    </p>
                </div>
                <div>
                    {!isLoggedIn ? (
                        <button onClick={handleDemoLogin} style={styles.demoLoginBtn}>
                            ⚡ Quick Demo Login
                        </button>
                    ) : (
                        <span style={styles.authBadge}>Authenticated ✅</span>
                    )}
                </div>
            </header>

            {error && <div style={styles.errorBanner}>⚠️ {error}</div>}
            {statusMsg && <div style={styles.statusBanner}>{statusMsg}</div>}

            <div style={styles.grid}>
                {/* INPUT PANEL */}
                <div style={styles.card}>
                    <h2 style={styles.cardTitle}>⚙️ Student Profile Inputs</h2>

                    <div style={styles.fieldGroup}>
                        <label style={styles.label}>
                            Academic Workload Score (0 - 100): <strong>{profile.workload_intensity_score}</strong>
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={profile.workload_intensity_score}
                            onChange={(e) => handleInputChange("workload_intensity_score", parseFloat(e.target.value))}
                            style={styles.slider}
                        />
                    </div>

                    <div style={styles.fieldRow}>
                        <div style={{ flex: 1 }}>
                            <label style={styles.label}>Stress Score (1-10)</label>
                            <input
                                type="number"
                                min="1"
                                max="10"
                                value={profile.stress_score}
                                onChange={(e) => handleInputChange("stress_score", parseFloat(e.target.value))}
                                style={styles.input}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={styles.label}>Daily Sleep (hrs)</label>
                            <input
                                type="number"
                                step="0.5"
                                min="2"
                                max="12"
                                value={profile.sleep_hours}
                                onChange={(e) => handleInputChange("sleep_hours", parseFloat(e.target.value))}
                                style={styles.input}
                            />
                        </div>
                    </div>

                    <div style={styles.fieldRow}>
                        <div style={{ flex: 1 }}>
                            <label style={styles.label}>Available Time (mins)</label>
                            <input
                                type="number"
                                min="10"
                                max="120"
                                value={profile.available_minutes}
                                onChange={(e) => handleInputChange("available_minutes", parseInt(e.target.value))}
                                style={styles.input}
                            />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label style={styles.label}>Physical Limitation</label>
                            <select
                                value={profile.physical_limitations}
                                onChange={(e) => handleInputChange("physical_limitations", e.target.value)}
                                style={styles.select}
                            >
                                <option value="none">None (Healthy)</option>
                                <option value="knee_pain">Knee Pain (Filter High-Impact)</option>
                                <option value="back_pain">Back Pain (Filter Heavy Squats)</option>
                                <option value="shoulder_injury">Shoulder Injury</option>
                            </select>
                        </div>
                    </div>

                    <div style={styles.fieldRow}>
                        <div style={{ flex: 1 }}>
                            <label style={styles.label}>Diet Preference</label>
                            <select
                                value={profile.diet_pref}
                                onChange={(e) => handleInputChange("diet_pref", e.target.value)}
                                style={styles.select}
                            >
                                <option value="sri_lankan">Sri Lankan Staples</option>
                                <option value="international">International</option>
                                <option value="vegetarian">Vegetarian</option>
                                <option value="any">Any / Balanced</option>
                            </select>
                        </div>
                    </div>

                    <div style={styles.fieldGroup}>
                        <label style={styles.label}>Equipment Access</label>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            {["dumbbells", "yoga_mat", "gym", "none"].map((item) => (
                                <button
                                    key={item}
                                    type="button"
                                    onClick={() => handleEquipmentToggle(item)}
                                    style={profile.equipment.includes(item) ? styles.chipActive : styles.chip}
                                >
                                    {item.replace("_", " ")}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* TOGGLES */}
                    <div style={styles.toggleBox}>
                        <div style={styles.toggleRow}>
                            <div>
                                <strong>🎓 Exam Period Mode</strong>
                                <div style={{ fontSize: "12px", color: "#64748b" }}>
                                    Triggers 50% workout duration cut for peak study weeks
                                </div>
                            </div>
                            <input
                                type="checkbox"
                                checked={isExamPeriod}
                                onChange={(e) => setIsExamPeriod(e.target.checked)}
                                style={styles.checkbox}
                            />
                        </div>

                        <div style={styles.toggleRow}>
                            <div>
                                <strong>📊 Recommender Algorithm Mode</strong>
                                <div style={{ fontSize: "12px", color: "#64748b" }}>
                                    Toggle between Baseline Content Filter vs. Adaptive XGBoost
                                </div>
                            </div>
                            <button
                                onClick={() => setUseBaseline(!useBaseline)}
                                style={useBaseline ? styles.baselineBtn : styles.xgbBtn}
                            >
                                {useBaseline ? "Rule-Based Baseline" : "🤖 Adaptive XGBoost"}
                            </button>
                        </div>
                    </div>

                    <button onClick={runModel} disabled={loading} style={styles.runBtn}>
                        {loading ? "Calculating..." : "🚀 Run ML Prediction Engine"}
                    </button>
                </div>

                {/* RESULTS PANEL */}
                <div style={styles.card}>
                    <h2 style={styles.cardTitle}>🎯 ML Model Recommendation Results</h2>

                    {recommendations ? (
                        <div>
                            {/* META BADGES */}
                            <div style={styles.metaRow}>
                                <span style={styles.metaBadge}>
                                    Model: <strong>{recommendations.model_version}</strong>
                                </span>
                                <span style={styles.metaBadge}>
                                    Context Aware: <strong>{recommendations.context_aware ? "YES ✅" : "NO ❌"}</strong>
                                </span>
                                {recommendations.recovery_mode && (
                                    <span style={{ ...styles.metaBadge, backgroundColor: "#fee2e2", color: "#991b1b" }}>
                                        ⚠️ Recovery Mode Active
                                    </span>
                                )}
                            </div>

                            {/* WORKOUT SECTION */}
                            <div style={{ marginTop: "20px" }}>
                                <h3 style={styles.sectionHeader}>🏋️ Recommended Workouts</h3>
                                <div style={styles.list}>
                                    {(recommendations.exercises || recommendations.recommended_workouts)?.map((w, idx) => (
                                        <div key={idx} style={styles.resultItem}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <h4 style={{ margin: 0, color: "#0f172a" }}>{w.name}</h4>
                                                <span style={styles.timeTag}>{w.duration_mins} mins</span>
                                            </div>
                                            <div style={styles.tagsRow}>
                                                <span style={styles.tag}>Muscle: {w.muscle || w.category}</span>
                                                <span style={styles.tag}>Intensity: {w.intensity}</span>
                                                {w.limitation_safe && (
                                                    <span style={{ ...styles.tag, backgroundColor: "#dcfce7", color: "#166534" }}>
                                                        🛡️ Limitation Safe
                                                    </span>
                                                )}
                                            </div>
                                            {w.description && <p style={styles.desc}>{w.description}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* MEAL SECTION */}
                            <div style={{ marginTop: "24px" }}>
                                <h3 style={styles.sectionHeader}>🥗 Recommended Nutrition & Meals</h3>
                                <div style={styles.list}>
                                    {(recommendations.meals || recommendations.recommended_meals)?.map((m, idx) => (
                                        <div key={idx} style={styles.resultItem}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                                <h4 style={{ margin: 0, color: "#0f172a" }}>{m.name}</h4>
                                                <span style={styles.calTag}>{m.calories || 450} kcal</span>
                                            </div>
                                            <div style={styles.tagsRow}>
                                                <span style={styles.tag}>Cuisine: {m.cuisine || "Sri Lankan"}</span>
                                                <span style={styles.tag}>Prep: {m.prep_time_mins || 15} mins</span>
                                                {m.protein && <span style={styles.tag}>Protein: {m.protein}g</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div style={styles.emptyState}>
                            Click <strong>"Run ML Prediction Engine"</strong> to generate dynamic recommendations.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

const styles = {
    container: {
        maxWidth: "1200px",
        margin: "0 auto",
        padding: "24px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        backgroundColor: "#f8fafc",
        minHeight: "100vh",
    },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "24px",
        paddingBottom: "16px",
        borderBottom: "1px solid #e2e8f0",
    },
    badge: {
        backgroundColor: "#0284c7",
        color: "#ffffff",
        fontSize: "11px",
        fontWeight: "700",
        letterSpacing: "1px",
        padding: "4px 8px",
        borderRadius: "4px",
    },
    title: {
        fontSize: "28px",
        fontWeight: "800",
        color: "#0f172a",
        margin: "8px 0 4px 0",
    },
    subtitle: {
        color: "#64748b",
        margin: 0,
        fontSize: "14px",
    },
    demoLoginBtn: {
        backgroundColor: "#16a34a",
        color: "#fff",
        border: "none",
        padding: "10px 18px",
        borderRadius: "8px",
        fontWeight: "700",
        fontSize: "14px",
        cursor: "pointer",
        boxShadow: "0 2px 4px rgba(22,163,74,0.2)",
    },
    authBadge: {
        backgroundColor: "#dcfce7",
        color: "#15803d",
        padding: "6px 12px",
        borderRadius: "16px",
        fontSize: "12px",
        fontWeight: "700",
    },
    errorBanner: {
        backgroundColor: "#fef2f2",
        border: "1px solid #fca5a5",
        color: "#991b1b",
        padding: "12px 16px",
        borderRadius: "8px",
        marginBottom: "20px",
        fontSize: "14px",
    },
    statusBanner: {
        backgroundColor: "#f0fdf4",
        border: "1px solid #86efac",
        color: "#166534",
        padding: "12px 16px",
        borderRadius: "8px",
        marginBottom: "20px",
        fontSize: "14px",
    },
    grid: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "24px",
    },
    card: {
        backgroundColor: "#ffffff",
        borderRadius: "12px",
        padding: "24px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        border: "1px solid #e2e8f0",
    },
    cardTitle: {
        fontSize: "18px",
        fontWeight: "700",
        color: "#0f172a",
        marginTop: 0,
        marginBottom: "20px",
        paddingBottom: "12px",
        borderBottom: "1px solid #f1f5f9",
    },
    fieldGroup: {
        marginBottom: "16px",
    },
    fieldRow: {
        display: "flex",
        gap: "16px",
        marginBottom: "16px",
    },
    label: {
        display: "block",
        fontSize: "13px",
        fontWeight: "600",
        color: "#334155",
        marginBottom: "6px",
    },
    input: {
        width: "100%",
        padding: "8px 12px",
        borderRadius: "6px",
        border: "1px solid #cbd5e1",
        fontSize: "14px",
        boxSizing: "border-box",
    },
    select: {
        width: "100%",
        padding: "8px 12px",
        borderRadius: "6px",
        border: "1px solid #cbd5e1",
        fontSize: "14px",
        boxSizing: "border-box",
        backgroundColor: "#fff",
    },
    slider: {
        width: "100%",
        cursor: "pointer",
    },
    chip: {
        padding: "6px 12px",
        borderRadius: "16px",
        border: "1px solid #cbd5e1",
        backgroundColor: "#f1f5f9",
        color: "#475569",
        fontSize: "12px",
        cursor: "pointer",
        textTransform: "capitalize",
    },
    chipActive: {
        padding: "6px 12px",
        borderRadius: "16px",
        border: "1px solid #0284c7",
        backgroundColor: "#e0f2fe",
        color: "#0369a1",
        fontSize: "12px",
        fontWeight: "600",
        cursor: "pointer",
        textTransform: "capitalize",
    },
    toggleBox: {
        backgroundColor: "#f8fafc",
        borderRadius: "8px",
        padding: "16px",
        margin: "20px 0",
        border: "1px solid #e2e8f0",
    },
    toggleRow: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "12px",
    },
    checkbox: {
        width: "20px",
        height: "20px",
        cursor: "pointer",
    },
    xgbBtn: {
        backgroundColor: "#059669",
        color: "#fff",
        border: "none",
        padding: "8px 14px",
        borderRadius: "6px",
        fontSize: "12px",
        fontWeight: "700",
        cursor: "pointer",
    },
    baselineBtn: {
        backgroundColor: "#64748b",
        color: "#fff",
        border: "none",
        padding: "8px 14px",
        borderRadius: "6px",
        fontSize: "12px",
        fontWeight: "700",
        cursor: "pointer",
    },
    runBtn: {
        width: "100%",
        backgroundColor: "#2563eb",
        color: "#ffffff",
        border: "none",
        padding: "12px",
        borderRadius: "8px",
        fontSize: "15px",
        fontWeight: "700",
        cursor: "pointer",
        boxShadow: "0 2px 4px rgba(37,99,235,0.2)",
    },
    metaRow: {
        display: "flex",
        gap: "10px",
        flexWrap: "wrap",
        marginBottom: "16px",
    },
    metaBadge: {
        backgroundColor: "#f1f5f9",
        color: "#334155",
        fontSize: "12px",
        padding: "6px 12px",
        borderRadius: "6px",
        border: "1px solid #e2e8f0",
    },
    sectionHeader: {
        fontSize: "15px",
        fontWeight: "700",
        color: "#1e293b",
        marginBottom: "12px",
        borderBottom: "1px dashed #cbd5e1",
        paddingBottom: "6px",
    },
    list: {
        display: "flex",
        flexDirection: "column",
        gap: "10px",
    },
    resultItem: {
        backgroundColor: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: "8px",
        padding: "12px 14px",
    },
    timeTag: {
        backgroundColor: "#dbeafe",
        color: "#1e40af",
        fontSize: "12px",
        fontWeight: "700",
        padding: "2px 8px",
        borderRadius: "12px",
    },
    calTag: {
        backgroundColor: "#fef3c7",
        color: "#92400e",
        fontSize: "12px",
        fontWeight: "700",
        padding: "2px 8px",
        borderRadius: "12px",
    },
    tagsRow: {
        display: "flex",
        gap: "6px",
        marginTop: "6px",
    },
    tag: {
        backgroundColor: "#ffffff",
        border: "1px solid #cbd5e1",
        color: "#475569",
        fontSize: "11px",
        padding: "2px 6px",
        borderRadius: "4px",
    },
    desc: {
        fontSize: "12px",
        color: "#64748b",
        margin: "6px 0 0 0",
    },
    emptyState: {
        textAlign: "center",
        color: "#94a3b8",
        padding: "40px 20px",
        fontSize: "14px",
    },
};

export default PhysicalModelTester;
