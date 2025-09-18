import React, { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleGenAI, Chat } from "@google/genai";

interface ChatMessage {
    sender: 'user' | 'ai' | 'admin';
    text: string;
}

const App: React.FC = () => {
    // State for the end-user form
    const [name, setName] = useState('');
    const [birthYear, setBirthYear] = useState('');
    const [gender, setGender] = useState('');
    const [uploadedImage, setUploadedImage] = useState<File | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    
    // State for the "teacher" input
    const [promptInstruction, setPromptInstruction] = useState('');
    const [knowledgeBase, setKnowledgeBase] = useState('');

    // App state
    const [appState, setAppState] = useState<'form' | 'chat'>('form');
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [longTermMemory, setLongTermMemory] = useState<ChatMessage[]>([]);
    const [chat, setChat] = useState<Chat | null>(null);
    const [isAiEnabled, setIsAiEnabled] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [chatInput, setChatInput] = useState('');
    const chatContainerRef = useRef<HTMLDivElement>(null);


    // Tab and authentication state
    const [activeTab, setActiveTab] = useState('user');
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [passwordInput, setPasswordInput] = useState('');
    const [passwordError, setPasswordError] = useState('');
    
    const TEACHER_PASSWORD = 'ADMIN';

    useEffect(() => {
        // Auto-scroll to the latest message
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatHistory]);

    const handlePasswordSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (passwordInput === TEACHER_PASSWORD) {
            setIsAuthenticated(true);
            setPasswordError('');
            setPasswordInput(''); 
        } else {
            setPasswordError('Mật khẩu không đúng. Vui lòng thử lại.');
        }
    };

    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
            reader.readAsDataURL(file);
        });
    };

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setUploadedImage(file);
            const previewUrl = URL.createObjectURL(file);
            if (imagePreview) {
                URL.revokeObjectURL(imagePreview);
            }
            setImagePreview(previewUrl);
        }
    };

    const handleStartChat = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!name || !birthYear || !gender || !uploadedImage) {
            setError('Vui lòng điền đầy đủ thông tin và tải lên hình ảnh quẻ của bạn.');
            return;
        }

        setIsLoading(true);
        setError('');
        setChatHistory([]);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
            
            let systemInstruction = "Bạn là một thầy bói tình duyên uyên bác, huyền bí và sâu sắc dựa trên Kinh Dịch. Hãy luận giải quẻ trong hình ảnh mà người dùng cung cấp. Lời phán của bạn nên mang tính tích cực và đưa ra lời khuyên. Trả lời bằng tiếng Việt.";

            if (promptInstruction.trim() !== '') {
                systemInstruction += `\n\nCHỈ DẪN PROMPT BỔ SUNG: "${promptInstruction}"`;
            }
            if (knowledgeBase.trim() !== '') {
                systemInstruction += `\n\nKIẾN THỨC NỀN BỔ SUNG (DÙNG LÀM TÀI LIỆU THAM KHẢO CHÍNH): "${knowledgeBase}"`;
            }

            if (longTermMemory.length > 0) {
                const memoryTranscript = longTermMemory.map(msg => {
                    const senderName = msg.sender === 'user' ? 'Người Dùng' : msg.sender === 'ai' ? 'Thầy Bói AI' : 'Thầy Bói Trực Tiếp';
                    return `${senderName}: ${msg.text}`;
                }).join('\n');
                systemInstruction += `\n\nĐÂY LÀ LỊCH SỬ CÁC CUỘC TRÒ CHUYỆN TRƯỚC ĐÓ ĐỂ BẠN HỌC HỎI VÀ CẢI THIỆN. HÃY PHÂN TÍCH VÀ RÚT KINH NGHIỆM TỪ CHÚNG:\n---\n${memoryTranscript}\n---`;
            }

            const newChat = ai.chats.create({
                model: "gemini-2.5-flash",
                config: { systemInstruction }
            });
            setChat(newChat);

            const imageBase64 = await fileToBase64(uploadedImage);
            const initialPrompt = `Tên tôi là ${name}, sinh năm ${birthYear}, giới tính ${gender}. Đây là quẻ tôi vừa gieo được, xin hãy luận giải về tình duyên cho tôi.`;
            
            const response = await newChat.sendMessage({
                message: [
                    initialPrompt,
                    {
                        inlineData: {
                            data: imageBase64,
                            mimeType: uploadedImage.type,
                        },
                    },
                ],
            });

            setChatHistory([{ sender: 'ai', text: response.text }]);
            setAppState('chat');

        } catch (err) {
            console.error(err);
            setError('Đã có lỗi xảy ra khi bắt đầu luận giải. Vui lòng thử lại sau.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSendMessage = async (e: React.FormEvent, sender: 'user' | 'admin') => {
        e.preventDefault();
        if (!chatInput.trim() || !chat) return;

        const userMessage: ChatMessage = { sender, text: chatInput };
        setChatHistory(prev => [...prev, userMessage]);
        const currentInput = chatInput;
        setChatInput('');
        setIsLoading(true);

        if (sender === 'user' && !isAiEnabled) {
             setIsLoading(false);
             return; 
        }
        
        if (sender === 'admin' || (sender === 'user' && isAiEnabled)) {
             try {
                const response = await chat.sendMessage({ message: currentInput });
                setChatHistory(prev => [...prev, { sender: 'ai', text: response.text }]);
            } catch (err) {
                console.error("Error sending message:", err);
                setChatHistory(prev => [...prev, { sender: 'ai', text: "Xin lỗi, đã có lỗi xảy ra, tôi không thể trả lời lúc này." }]);
            } finally {
                setIsLoading(false);
            }
        }
    };
    
    const handleEndChat = () => {
        if (chatHistory.length > 0) {
            setLongTermMemory(prev => [...prev, ...chatHistory]);
        }
        setAppState('form');
        setChatHistory([]);
        setName('');
        setBirthYear('');
        setGender('');
        setUploadedImage(null);
        setImagePreview(null);
        setError('');
    };
    
    const handleClearMemory = () => {
        setLongTermMemory([]);
    }

    const renderChatInterface = (role: 'user' | 'admin') => (
        <div className="chat-view">
            {role === 'user' && <button onClick={handleEndChat} className="end-chat-button">Kết thúc & Bắt đầu lại</button>}
            <div className="chat-container" ref={chatContainerRef}>
                {chatHistory.map((msg, index) => (
                    <div key={index} className={`message ${msg.sender}-message`}>
                        <p>
                            <strong>
                                {msg.sender === 'user' && 'Bạn'}
                                {msg.sender === 'ai' && 'Thầy Bói AI'}
                                {msg.sender === 'admin' && 'Thầy Bói Trực Tiếp'}
                            </strong>
                            : {msg.text}
                        </p>
                    </div>
                ))}
                {isLoading && <div className="message ai-message"><span className="loader"></span></div>}
            </div>
            <form onSubmit={(e) => handleSendMessage(e, role)} className="chat-input-form">
                <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={role === 'user' ? 'Hỏi thêm về lời giải...' : 'Trả lời người dùng...'}
                    disabled={isLoading || (role === 'user' && !isAiEnabled)}
                />
                <button type="submit" disabled={isLoading || !chatInput.trim() || (role === 'user' && !isAiEnabled)}>Gửi</button>
            </form>
            {role === 'user' && !isAiEnabled && 
                <p className="ai-disabled-notice">Thầy bói AI đang bận. Vui lòng chờ Thầy Bói Trực Tiếp trả lời.</p>
            }
        </div>
    );

    return (
        <div className="container">
            <div className="tabs">
                <button 
                    className={`tab-button ${activeTab === 'user' ? 'active' : ''}`}
                    onClick={() => setActiveTab('user')}
                    aria-controls="user-panel"
                    aria-selected={activeTab === 'user'}
                >
                    Bói Tình Duyên
                </button>
                <button 
                    className={`tab-button ${activeTab === 'teacher' ? 'active' : ''}`}
                    onClick={() => setActiveTab('teacher')}
                    aria-controls="teacher-panel"
                    aria-selected={activeTab === 'teacher'}
                >
                    Dạy AI & Quản Lý
                </button>
            </div>

            {activeTab === 'user' && (
                <div id="user-panel" role="tabpanel">
                    {appState === 'form' ? (
                        <>
                            <h1>Bói Tình Duyên</h1>
                            <form onSubmit={handleStartChat}>
                                <div className="form-group">
                                    <label htmlFor="name">Tên của bạn:</label>
                                    <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ví dụ: Hoàng" aria-required="true" />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="birthYear">Năm sinh:</label>
                                    <input id="birthYear" type="number" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} placeholder="Ví dụ: 1999" aria-required="true" />
                                </div>
                                <div className="form-group">
                                    <label>Giới tính:</label>
                                    <div className="gender-selection">
                                        <label className="gender-option"><input type="radio" name="gender" value="Nam" checked={gender === 'Nam'} onChange={(e) => setGender(e.target.value)} /> Nam</label>
                                        <label className="gender-option"><input type="radio" name="gender" value="Nữ" checked={gender === 'Nữ'} onChange={(e) => setGender(e.target.value)} /> Nữ</label>
                                    </div>
                                </div>
                                <a href="https://hocvienlyso.org/gieo-que-mai-hoa.html" target="_blank" rel="noopener noreferrer" className="external-link-button">
                                    Gieo Quẻ và Lấy Ảnh Tại Đây
                                </a>
                                <div className="image-upload-container">
                                    <label htmlFor="image-upload" className="image-upload-label">
                                        {imagePreview ? <img src={imagePreview} alt="Xem trước quẻ" className="image-preview" /> : <span>Nhấn để tải lên hình ảnh quẻ (bắt buộc)</span>}
                                    </label>
                                    <input id="image-upload" type="file" accept="image/*" onChange={handleImageUpload} className="sr-only" />
                                </div>
                                <button type="submit" disabled={isLoading}>{isLoading ? <span className="loader"></span> : 'Xem Quẻ & Bắt Đầu Trò Chuyện'}</button>
                            </form>
                            {error && <p className="error-message">{error}</p>}
                        </>
                    ) : (
                         renderChatInterface('user')
                    )}
                </div>
            )}
            
            {activeTab === 'teacher' && (
                <div id="teacher-panel" role="tabpanel">
                    {!isAuthenticated ? (
                        <div className="password-prompt">
                            <h2>Truy Cập Khu Vực Quản Lý</h2>
                            <form onSubmit={handlePasswordSubmit}>
                                <div className="form-group">
                                    <label htmlFor="password">Mật khẩu:</label>
                                    <input type="password" id="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} />
                                </div>
                                <button type="submit">Xác Nhận</button>
                                {passwordError && <p className="error-message">{passwordError}</p>}
                            </form>
                        </div>
                    ) : (
                        <div className="admin-dashboard">
                            <h2>Bảng Điều Khiển</h2>
                            <div className="admin-section">
                                <h3>Chỉ Dẫn AI (Prompt)</h3>
                                <p className="teacher-description">
                                    Cung cấp chỉ dẫn về vai trò, giọng văn, và cách hành xử của AI.
                                </p>
                                <div className="form-group">
                                    <label htmlFor="promptInstruction">Prompt cho AI:</label>
                                    <textarea 
                                        id="promptInstruction" 
                                        value={promptInstruction} 
                                        onChange={(e) => setPromptInstruction(e.target.value)} 
                                        placeholder="Ví dụ: Bạn là một nhà hiền triết, nói chuyện nhẹ nhàng, sâu sắc và luôn đưa ra những ví dụ ẩn dụ..." 
                                        style={{minHeight: '120px'}} 
                                    />
                                </div>
                            </div>
                            <div className="admin-section">
                                <h3>Kiến Thức Nền</h3>
                                <p className="teacher-description">
                                    Cung cấp dữ liệu, kiến thức cụ thể để AI dựa vào đó trả lời. Ví dụ: nội dung giải 64 quẻ Kinh Dịch.
                                </p>
                                <div className="form-group">
                                    <label htmlFor="knowledgeBase">Nội dung kiến thức:</label>
                                    <textarea 
                                        id="knowledgeBase" 
                                        value={knowledgeBase} 
                                        onChange={(e) => setKnowledgeBase(e.target.value)} 
                                        placeholder="Ví dụ: Quẻ Càn (☰☰): Tượng trưng cho trời, sức mạnh, sự sáng tạo. Người gieo được quẻ này..." 
                                        style={{minHeight: '180px'}} 
                                    />
                                </div>
                            </div>
                             <div className="admin-section">
                                <h3>Bộ Nhớ Học Tập của AI</h3>
                                <div className="memory-controls">
                                     <p>AI sẽ học hỏi từ các cuộc trò chuyện đã lưu dưới đây.</p>
                                     <button onClick={handleClearMemory} className="clear-memory-button">Xóa Bộ Nhớ Học Tập</button>
                                </div>
                                <div className="memory-container">
                                    {longTermMemory.length > 0 ? (
                                        longTermMemory.map((msg, index) => (
                                             <div key={index} className={`memory-message memory-${msg.sender}`}>
                                                <strong>{msg.sender === 'user' ? 'Người Dùng' : msg.sender === 'ai' ? 'AI' : 'Admin'}:</strong> {msg.text}
                                            </div>
                                        ))
                                    ) : (
                                        <p className="no-memory-notice">Bộ nhớ của AI hiện đang trống.</p>
                                    )}
                                </div>
                            </div>
                            <div className="admin-section">
                                <h3>Quản Lý Trò Chuyện Trực Tiếp</h3>
                                <div className="toggle-switch-container">
                                    <label htmlFor="ai-toggle" className="toggle-label">Cho phép AI trả lời:</label>
                                    <label className="switch">
                                        <input id="ai-toggle" type="checkbox" checked={isAiEnabled} onChange={() => setIsAiEnabled(!isAiEnabled)} />
                                        <span className="slider round"></span>
                                    </label>
                                </div>
                                {chatHistory.length > 0 ? (
                                    renderChatInterface('admin')
                                ) : (
                                    <p className="no-chat-notice">Chưa có cuộc trò chuyện nào diễn ra.</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<App />);