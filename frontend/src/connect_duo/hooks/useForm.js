// hooks/useForm.js
import { useState } from 'react';

const useForm = (initialState = {}) => {
    const [formData, setFormData] = useState(initialState);

    const inputChangeHandler = (event) => {
        const { name, value } = event.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const resetForm = () => setFormData(initialState);

    // setFormData를 함께 리턴하면 특수 상황(수동 변경 등)에 대응하기 좋습니다.
    return { formData, inputChangeHandler, resetForm, setFormData };
};

export default useForm;
