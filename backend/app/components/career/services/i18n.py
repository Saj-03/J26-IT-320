"""
Sinhala / Tamil / English text for everything the career API writes for students.

VIVA: "All scoring and matching run on the English data (the trained model was fitted on the
English survey answers), and only the text shown to the student is translated at the end.
So the language never changes a recommendation, a score or a gap - only how it is explained."

Content translations (career names, descriptions, interview questions, roadmap plans, personas,
faculty and area names) are in data/i18n/<lang>.json; sentence templates are below.
Anything missing falls back to English, so a gap in a translation never breaks the API.
"""
import json
from functools import lru_cache
from pathlib import Path

SUPPORTED = ("en", "si", "ta")
I18N_DIR = Path(__file__).resolve().parents[1] / "data" / "i18n"
LANGUAGE_NAMES = {"en": "English", "si": "Sinhala", "ta": "Tamil"}


def normalise(lang) -> str:
    return lang if lang in SUPPORTED else "en"


TEXT = {
    "en": {
        "and": " and ", "sep": ", ",
        # recommender
        "explain_strengths": "{name} is recommended because your {skills} skills are close to this career requirement.",
        "explain_shape": "{name} is a possible direction based on the overall shape of your skill profile.",
        "explain_family": " Students with a background similar to yours often prefer {family} careers (model estimate {pct}).",
        "explain_bonus": " It also ranks higher because {reasons}.",
        "explain_improve": " You may need to improve {skills}.",
        "explain_all_met": " You already meet every core skill level for this career.",
        "explain_preferred": " It is included because it is your preferred career role.",
        "reason_faculty": "it matches your {faculty} faculty field",
        "reason_area": "it matches your interest in {area}",
        "reason_role": "it matches your preferred career role",
        "reason_work": "your career-related work gives you practical experience",
        "reason_leadership": "your extracurricular leadership role fits this career",
        "family_software": "software and infrastructure", "family_data": "data", "family_cybersecurity": "cybersecurity",
        "family_business": "business and management", "family_design": "design",
        # gap analysis / roadmap
        "status_Strong": "Strong", "status_Needs Improvement": "Needs Improvement", "status_Critical Gap": "Critical Gap",
        "roadmap_reason": "Your {skill} is {current}/5 but {career} needs {required}/5 ({status}).",
        "weeks_short": "2-3 weeks", "weeks_medium": "4-6 weeks", "weeks_long": "6-8 weeks",
        "roadmap_message": "{n} skill(s) to develop for {career}.",
        "roadmap_message_done": "You already meet every core skill level for {career}.",
        # career milestones (roadmap)
        "ms_courses_title": "Take the core courses",
        "ms_courses_desc": "Build the core knowledge for {career}.",
        "ms_courses_when": "Weeks 1-4",
        "ms_tools_title": "Get hands-on with the tools",
        "ms_tools_desc": "Tools employers expect for {career}. Practise each one on a small task.",
        "ms_tools_when": "Alongside your courses",
        "ms_projects_title": "Build portfolio projects",
        "ms_projects_desc": "Projects you can show in interviews and on your CV.",
        "ms_projects_when": "Weeks 4-10",
        "ms_cert_title": "Aim for a certification (optional)",
        "ms_cert_desc": "A recognised certificate makes your CV stronger for {career}.",
        "ms_cert_when": "After your projects",
        "ms_interview_title": "Practise interviews",
        "ms_interview_desc": "Answer real {career} interview questions in the AI Interview Simulator and get feedback.",
        "ms_interview_when": "Before you apply",
        # interview feedback
        "pace_slow": "Your pace was {wpm} words/min. Try speaking a little faster (aim for {low}-{high}).",
        "pace_fast": "Your pace was {wpm} words/min. Slow down slightly for clarity (aim for {low}-{high}).",
        "pace_good": "Good speaking pace ({wpm} words/min).",
        "cam_centre": "Stay centred in the camera frame throughout your answer.",
        "cam_look": "Look toward the camera more often, as you would look at an interviewer.",
        "cam_good": "Good camera presence: you stayed in frame and faced the camera.",
        "fb_relevant": "Your answer is relevant and close to what interviewers expect.",
        "fb_direct": "Answer the question more directly - focus on what was actually asked.",
        "fb_covered": "You covered key concepts: {items}.",
        "fb_mention": "Also mention: {items}.",
        "fb_short": "Your answer is short. Aim for about 60-200 words (1-2 minutes).",
        "fb_long": "Keep your answer focused - try to finish within about 2 minutes.",
        "fb_star_missing": "Use the STAR method - add the {parts} part(s).",
        "fb_star_good": "Clear STAR structure (Situation, Task, Action, Result).",
        "fb_fillers": "Reduce filler words ({items}). Pause briefly instead.",
        "star_situation": "Situation", "star_task": "Task", "star_action": "Action", "star_result": "Result",
        "advisory": "Interview practice feedback is advisory.",
        "band_ready": "Interview-ready", "band_almost": "Almost ready - keep practising", "band_more": "Needs more practice",
        "privacy_1": "Interview practice feedback is advisory.",
        "privacy_2": "Raw audio/video will not be stored.",
        "privacy_3": "Facial presence refers only to observable presentation cues, not personality or emotion detection.",
    },
    "si": {
        "and": " සහ ", "sep": ", ",
        "explain_strengths": "ඔබේ {skills} කුසලතා මෙම රැකියාවට අවශ්‍ය මට්ටමට ආසන්න බැවින් {name} නිර්දේශ කෙරේ.",
        "explain_shape": "ඔබේ කුසලතා පැතිකඩේ සමස්ත ස්වරූපය අනුව {name} ඔබට ගැළපිය හැකි දිශාවකි.",
        "explain_family": " ඔබට සමාන පසුබිමක් ඇති සිසුන් බොහෝ විට {family} රැකියාවලට කැමැත්තක් දක්වයි (ආකෘති ඇස්තමේන්තුව {pct}).",
        "explain_bonus": " {reasons} බැවින් එය ඉහළ ස්ථානයක් ගනී.",
        "explain_improve": " ඔබට {skills} වැඩිදියුණු කිරීමට සිදු විය හැක.",
        "explain_all_met": " මෙම රැකියාවට අවශ්‍ය සියලු මූලික කුසලතා මට්ටම් ඔබ දැනටමත් සපුරා ඇත.",
        "explain_preferred": " එය ඔබ කැමති රැකියා භූමිකාව බැවින් ලැයිස්තුවට ඇතුළත් කර ඇත.",
        "reason_faculty": "එය ඔබේ {faculty} පීඨයට අදාළ",
        "reason_area": "එය ඔබ උනන්දු වන {area} ක්ෂේත්‍රයට ගැළපෙන",
        "reason_role": "එය ඔබ කැමති රැකියා භූමිකාවට ගැළපෙන",
        "reason_work": "ඔබේ රැකියා සම්බන්ධ වැඩ මඟින් ඔබට ප්‍රායෝගික අත්දැකීම් ලැබී ඇති",
        "reason_leadership": "ඔබේ විෂය බාහිර නායකත්ව භූමිකාව මෙම රැකියාවට ගැළපෙන",
        "family_software": "මෘදුකාංග සහ යටිතල පහසුකම්", "family_data": "දත්ත", "family_cybersecurity": "සයිබර් ආරක්ෂණ",
        "family_business": "ව්‍යාපාර සහ කළමනාකරණ", "family_design": "නිර්මාණ",
        "status_Strong": "ශක්තිමත්", "status_Needs Improvement": "වැඩිදියුණු කළ යුතුය", "status_Critical Gap": "බරපතල හිඩැසක්",
        "roadmap_reason": "ඔබේ {skill} මට්ටම {current}/5 වුවත් {career} සඳහා {required}/5 අවශ්‍ය වේ ({status}).",
        "weeks_short": "සති 2-3", "weeks_medium": "සති 4-6", "weeks_long": "සති 6-8",
        "roadmap_message": "{career} සඳහා වර්ධනය කළ යුතු කුසලතා {n}ක් ඇත.",
        "roadmap_message_done": "{career} සඳහා අවශ්‍ය සියලු මූලික කුසලතා මට්ටම් ඔබ දැනටමත් සපුරා ඇත.",
        # career milestones (roadmap)
        "ms_courses_title": "මූලික පාඨමාලා හදාරන්න",
        "ms_courses_desc": "{career} සඳහා අවශ්‍ය මූලික දැනුම ගොඩනගා ගන්න.",
        "ms_courses_when": "සති 1-4",
        "ms_tools_title": "මෙවලම් ප්‍රායෝගිකව භාවිත කරන්න",
        "ms_tools_desc": "{career} සඳහා සේවා යෝජකයන් අපේක්ෂා කරන මෙවලම්. එක් එක් මෙවලම කුඩා කාර්යයකින් පුහුණු වන්න.",
        "ms_tools_when": "පාඨමාලා සමඟම",
        "ms_projects_title": "Portfolio ව්‍යාපෘති ගොඩනගන්න",
        "ms_projects_desc": "සම්මුඛ පරීක්ෂණවලදී සහ ඔබේ CV එකේ පෙන්විය හැකි ව්‍යාපෘති.",
        "ms_projects_when": "සති 4-10",
        "ms_cert_title": "සහතිකයක් ලබා ගැනීමට උත්සාහ කරන්න (විකල්ප)",
        "ms_cert_desc": "පිළිගත් සහතිකයක් {career} සඳහා ඔබේ CV එක ශක්තිමත් කරයි.",
        "ms_cert_when": "ව්‍යාපෘති අවසන් කළ පසු",
        "ms_interview_title": "සම්මුඛ පරීක්ෂණ පුහුණු වන්න",
        "ms_interview_desc": "AI සම්මුඛ පරීක්ෂණ සිමියුලේටරයේ සැබෑ {career} සම්මුඛ ප්‍රශ්නවලට පිළිතුරු දී ප්‍රතිපෝෂණ ලබා ගන්න.",
        "ms_interview_when": "අයදුම් කිරීමට පෙර",
        "pace_slow": "ඔබේ කතා කිරීමේ වේගය විනාඩියට වචන {wpm}කි. මඳක් වේගයෙන් කතා කිරීමට උත්සාහ කරන්න (ඉලක්කය {low}-{high}).",
        "pace_fast": "ඔබේ කතා කිරීමේ වේගය විනාඩියට වචන {wpm}කි. පැහැදිලි බව සඳහා මඳක් සෙමින් කතා කරන්න (ඉලක්කය {low}-{high}).",
        "pace_good": "හොඳ කතා කිරීමේ වේගයක් (විනාඩියට වචන {wpm}).",
        "cam_centre": "පිළිතුර දෙන අතරතුර කැමරා රාමුවේ මැද රැඳී සිටින්න.",
        "cam_look": "සම්මුඛ පරීක්ෂකයෙකු දෙස බලන්නාක් මෙන් කැමරාව දෙස නිතර බලන්න.",
        "cam_good": "හොඳ කැමරා පෙනුමක්: ඔබ රාමුව තුළ රැඳී කැමරාව දෙසට මුහුණලා සිටියා.",
        "fb_relevant": "ඔබේ පිළිතුර අදාළ වන අතර සම්මුඛ පරීක්ෂකයින් බලාපොරොත්තු වන දෙයට ආසන්නයි.",
        "fb_direct": "ප්‍රශ්නයට වඩාත් සෘජුව පිළිතුරු දෙන්න - ඇසූ දෙය කෙරෙහි අවධානය යොමු කරන්න.",
        "fb_covered": "ඔබ ප්‍රධාන සංකල්ප ආවරණය කළා: {items}.",
        "fb_mention": "මේවාද සඳහන් කරන්න: {items}.",
        "fb_short": "ඔබේ පිළිතුර කෙටියි. වචන 60-200ක් පමණ (විනාඩි 1-2) ඉලක්ක කරන්න.",
        "fb_long": "පිළිතුර කේන්ද්‍රගතව තබා ගන්න - විනාඩි 2ක් පමණ ඇතුළත අවසන් කිරීමට උත්සාහ කරන්න.",
        "fb_star_missing": "STAR ක්‍රමය භාවිත කරන්න - {parts} කොටස එක් කරන්න.",
        "fb_star_good": "පැහැදිලි STAR ව්‍යුහයක් (තත්ත්වය, කාර්යය, ක්‍රියාව, ප්‍රතිඵලය).",
        "fb_fillers": "පිරවුම් වචන ({items}) අඩු කරන්න. ඒ වෙනුවට මොහොතක් නවතින්න.",
        "star_situation": "තත්ත්වය (Situation)", "star_task": "කාර්යය (Task)", "star_action": "ක්‍රියාව (Action)",
        "star_result": "ප්‍රතිඵලය (Result)",
        "advisory": "සම්මුඛ පරීක්ෂණ පුහුණු ප්‍රතිචාර උපදේශාත්මක පමණි.",
        "band_ready": "සම්මුඛ පරීක්ෂණයට සූදානම්", "band_almost": "බොහෝ දුරට සූදානම් - දිගටම පුහුණු වන්න",
        "band_more": "තවත් පුහුණුව අවශ්‍යයි",
        "privacy_1": "සම්මුඛ පරීක්ෂණ පුහුණු ප්‍රතිචාර උපදේශාත්මක පමණි.",
        "privacy_2": "ශබ්ද හෝ වීඩියෝ පටිගත කිරීම් ගබඩා නොකෙරේ.",
        "privacy_3": "මුහුණ හඳුනාගැනීම නිරීක්ෂණය කළ හැකි ඉදිරිපත් කිරීමේ ලක්ෂණ පමණක් සලකයි; පෞරුෂය හෝ හැඟීම් හඳුනා නොගනී.",
    },
    "ta": {
        "and": " மற்றும் ", "sep": ", ",
        "explain_strengths": "உங்கள் {skills} திறன்கள் இந்தத் தொழிலுக்குத் தேவையான நிலைக்கு அருகில் உள்ளதால் {name} பரிந்துரைக்கப்படுகிறது.",
        "explain_shape": "உங்கள் திறன் சுயவிவரத்தின் ஒட்டுமொத்த அமைப்பின் அடிப்படையில் {name} உங்களுக்கு ஏற்ற ஒரு திசையாக இருக்கலாம்.",
        "explain_family": " உங்களைப் போன்ற பின்னணி கொண்ட மாணவர்கள் பெரும்பாலும் {family} தொழில்களை விரும்புகிறார்கள் (மாதிரி மதிப்பீடு {pct}).",
        "explain_bonus": " {reasons} என்பதால் இது உயர்ந்த இடத்தில் உள்ளது.",
        "explain_improve": " நீங்கள் {skills} ஆகியவற்றை மேம்படுத்த வேண்டியிருக்கலாம்.",
        "explain_all_met": " இந்தத் தொழிலுக்கான அனைத்து முக்கியத் திறன் நிலைகளையும் நீங்கள் ஏற்கனவே பூர்த்தி செய்துள்ளீர்கள்.",
        "explain_preferred": " இது நீங்கள் விரும்பும் தொழில் பாத்திரம் என்பதால் சேர்க்கப்பட்டுள்ளது.",
        "reason_faculty": "இது உங்கள் {faculty} பீடத்துடன் பொருந்துகிறது",
        "reason_area": "இது நீங்கள் ஆர்வம் காட்டும் {area} துறையுடன் பொருந்துகிறது",
        "reason_role": "இது நீங்கள் விரும்பும் தொழில் பாத்திரத்துடன் பொருந்துகிறது",
        "reason_work": "உங்கள் தொழில் தொடர்பான பணி உங்களுக்கு நடைமுறை அனுபவத்தைத் தருகிறது",
        "reason_leadership": "உங்கள் பாடநெறிக்கு அப்பாற்பட்ட தலைமைப் பொறுப்பு இந்தத் தொழிலுக்குப் பொருந்துகிறது",
        "family_software": "மென்பொருள் மற்றும் உட்கட்டமைப்பு", "family_data": "தரவு", "family_cybersecurity": "இணையப் பாதுகாப்பு",
        "family_business": "வணிகம் மற்றும் முகாமைத்துவம்", "family_design": "வடிவமைப்பு",
        "status_Strong": "வலுவானது", "status_Needs Improvement": "மேம்பாடு தேவை", "status_Critical Gap": "கடுமையான இடைவெளி",
        "roadmap_reason": "உங்கள் {skill} நிலை {current}/5, ஆனால் {career} பதவிக்கு {required}/5 தேவை ({status}).",
        "weeks_short": "2-3 வாரங்கள்", "weeks_medium": "4-6 வாரங்கள்", "weeks_long": "6-8 வாரங்கள்",
        "roadmap_message": "{career} பதவிக்கு வளர்க்க வேண்டிய திறன்கள்: {n}.",
        "roadmap_message_done": "{career} பதவிக்கான அனைத்து முக்கியத் திறன் நிலைகளையும் நீங்கள் ஏற்கனவே பூர்த்தி செய்துள்ளீர்கள்.",
        # career milestones (roadmap)
        "ms_courses_title": "முக்கியப் பாடநெறிகளைக் கற்கவும்",
        "ms_courses_desc": "{career} பதவிக்குத் தேவையான அடிப்படை அறிவை வளர்த்துக்கொள்ளுங்கள்.",
        "ms_courses_when": "வாரங்கள் 1-4",
        "ms_tools_title": "கருவிகளை நேரடியாகப் பயிற்சி செய்யவும்",
        "ms_tools_desc": "{career} பதவிக்கு வேலை வழங்குநர்கள் எதிர்பார்க்கும் கருவிகள். ஒவ்வொன்றையும் ஒரு சிறிய பணியில் பயிற்சி செய்யுங்கள்.",
        "ms_tools_when": "பாடநெறிகளுடன் சேர்த்து",
        "ms_projects_title": "Portfolio திட்டங்களை உருவாக்கவும்",
        "ms_projects_desc": "நேர்காணல்களிலும் உங்கள் CV-யிலும் காட்டக்கூடிய திட்டங்கள்.",
        "ms_projects_when": "வாரங்கள் 4-10",
        "ms_cert_title": "ஒரு சான்றிதழைப் பெற முயற்சிக்கவும் (விருப்பத்தேர்வு)",
        "ms_cert_desc": "அங்கீகரிக்கப்பட்ட சான்றிதழ் {career} பதவிக்கு உங்கள் CV-யை வலுப்படுத்தும்.",
        "ms_cert_when": "திட்டங்களுக்குப் பிறகு",
        "ms_interview_title": "நேர்காணல் பயிற்சி செய்யவும்",
        "ms_interview_desc": "AI நேர்காணல் சிமுலேட்டரில் உண்மையான {career} நேர்காணல் கேள்விகளுக்குப் பதிலளித்து கருத்துகளைப் பெறுங்கள்.",
        "ms_interview_when": "விண்ணப்பிக்கும் முன்",
        "pace_slow": "உங்கள் பேச்சு வேகம் நிமிடத்திற்கு {wpm} சொற்கள். சற்று வேகமாகப் பேச முயற்சிக்கவும் (இலக்கு {low}-{high}).",
        "pace_fast": "உங்கள் பேச்சு வேகம் நிமிடத்திற்கு {wpm} சொற்கள். தெளிவுக்காகச் சற்று மெதுவாகப் பேசவும் (இலக்கு {low}-{high}).",
        "pace_good": "நல்ல பேச்சு வேகம் (நிமிடத்திற்கு {wpm} சொற்கள்).",
        "cam_centre": "பதிலளிக்கும் போது கேமரா சட்டகத்தின் நடுவில் இருங்கள்.",
        "cam_look": "நேர்காணல் செய்பவரைப் பார்ப்பது போல கேமராவை அடிக்கடி பாருங்கள்.",
        "cam_good": "நல்ல கேமரா தோற்றம்: நீங்கள் சட்டகத்திற்குள் இருந்து கேமராவை நோக்கியிருந்தீர்கள்.",
        "fb_relevant": "உங்கள் பதில் பொருத்தமானது, நேர்காணல் செய்பவர்கள் எதிர்பார்ப்பதற்கு அருகில் உள்ளது.",
        "fb_direct": "கேள்விக்கு மேலும் நேரடியாகப் பதிலளிக்கவும் - கேட்கப்பட்டதில் கவனம் செலுத்துங்கள்.",
        "fb_covered": "நீங்கள் முக்கியக் கருத்துகளைக் குறிப்பிட்டீர்கள்: {items}.",
        "fb_mention": "இவற்றையும் குறிப்பிடுங்கள்: {items}.",
        "fb_short": "உங்கள் பதில் சுருக்கமாக உள்ளது. சுமார் 60-200 சொற்கள் (1-2 நிமிடங்கள்) இலக்காகக் கொள்ளுங்கள்.",
        "fb_long": "பதிலைக் கவனம் சிதறாமல் வைத்திருங்கள் - சுமார் 2 நிமிடங்களுக்குள் முடிக்க முயற்சிக்கவும்.",
        "fb_star_missing": "STAR முறையைப் பயன்படுத்துங்கள் - {parts} பகுதியைச் சேர்க்கவும்.",
        "fb_star_good": "தெளிவான STAR அமைப்பு (சூழ்நிலை, பணி, செயல், முடிவு).",
        "fb_fillers": "நிரப்புச் சொற்களைக் ({items}) குறைக்கவும். அதற்குப் பதிலாகச் சற்று நிறுத்துங்கள்.",
        "star_situation": "சூழ்நிலை (Situation)", "star_task": "பணி (Task)", "star_action": "செயல் (Action)",
        "star_result": "முடிவு (Result)",
        "advisory": "நேர்காணல் பயிற்சிக் கருத்துகள் ஆலோசனை நோக்கத்திற்கு மட்டுமே.",
        "band_ready": "நேர்காணலுக்குத் தயார்", "band_almost": "கிட்டத்தட்டத் தயார் - தொடர்ந்து பயிற்சி செய்யுங்கள்",
        "band_more": "மேலும் பயிற்சி தேவை",
        "privacy_1": "நேர்காணல் பயிற்சிக் கருத்துகள் ஆலோசனை நோக்கத்திற்கு மட்டுமே.",
        "privacy_2": "ஒலி அல்லது காணொளிப் பதிவுகள் சேமிக்கப்படாது.",
        "privacy_3": "முக இருப்பு என்பது காணக்கூடிய விளக்கக் குறிப்புகளை மட்டுமே குறிக்கிறது; ஆளுமை அல்லது உணர்ச்சிகளைக் கண்டறிவதில்லை.",
    },
}


def t(lang: str, key: str, **values) -> str:
    """Sentence template in the chosen language (English if the key is missing)."""
    template = TEXT[normalise(lang)].get(key) or TEXT["en"][key]
    return template.format(**values)


@lru_cache
def _content(lang: str) -> dict:
    path = I18N_DIR / f"{lang}.json"
    if lang == "en" or not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def _lookup(lang: str, section: str, key: str, field: str = None):
    entry = _content(normalise(lang)).get(section, {}).get(key)
    if entry is None:
        return None
    return entry.get(field) if field else entry


def join(items: list[str], lang: str) -> str:
    """'a, b and c' in the chosen language."""
    if len(items) <= 1:
        return "".join(items)
    return t(lang, "sep").join(items[:-1]) + t(lang, "and") + items[-1]


def skill(key: str, lang: str) -> str:
    """'data_analysis' -> 'data analysis' (English, lower case for sentences) or the translation."""
    return _lookup(lang, "skills", key) or key.replace("_", " ")


def value(text: str, lang: str) -> str:
    """Survey answer values shown inside sentences (faculty, career area, ...)."""
    return _lookup(lang, "values", text) or text


def career_field(career: dict, field: str, lang: str) -> str:
    """career_name / description; career_area goes through the shared value list."""
    if field == "career_area":
        return value(career["career_area"], lang)
    return _lookup(lang, "careers", career["career_id"], field) or career[field]


def career_list(career: dict, field: str, lang: str) -> list[str]:
    """recommended_courses / recommended_projects; English if the translation is missing or out of date."""
    english = career.get(field) or []
    translated = _lookup(lang, "careers", career["career_id"], field)
    return translated if isinstance(translated, list) and len(translated) == len(english) else list(english)


def question_field(question: dict, field: str, lang: str) -> str:
    return _lookup(lang, "questions", question["id"], field) or question[field]


def plan_field(skill_key: str, field: str, english: str, lang: str) -> str:
    return _lookup(lang, "plans", skill_key, field) or english


def persona_text(persona: dict, lang: str) -> dict:
    tr = _lookup(lang, "personas", persona["name"]) or {}
    return {k: tr.get(k) or persona[k] for k in ("name", "description", "advice")}


def status(status_code: str, lang: str) -> str:
    return t(lang, f"status_{status_code}")
