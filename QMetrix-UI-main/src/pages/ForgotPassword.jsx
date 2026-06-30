import { useState } from 'react';
import { object, string } from 'yup';
import { useFormik } from 'formik';
import { Link, useNavigate } from 'react-router-dom';
import bgImage from '../assets/images/bgImg3.png';
import bgBase from '../assets/images/bgBase.png';
import logo from '../assets/images/logo.png';
import { toast, ToastContainer } from 'react-toastify';
import { userForgotPassword } from '../constants';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [initialLoginValues] = useState({ email: '' });
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [loading, setLoading] = useState(false);

  const validationSchema = object({
    email: string().email('Invalid email address').required('Email is required'),
  });

  const formik = useFormik({
    initialValues: initialLoginValues,
    enableReinitialize: true,
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      if (values.email != '') {
        setLoading(true);
        try {
          const response = await userForgotPassword({ email: values.email });
          const dataApi = response.data;
          if (dataApi.status || dataApi.success) {
            toast.success(`${dataApi.message}`);
            setTimeout(() => {
              navigate('/');
            }, 2000);
          } else {
            toast.error(`${dataApi.message}`);
            if (dataApi.redirectUrl) {
              setTimeout(() => {
                navigate(dataApi.redirectUrl);
              }, 2000); 
            }
          }
        } catch (err) {
          console.error('Forgot passsword failed:', err.message);
          if (err.response && err.response.data) {
            const errorData = err.response.data;
            toast.error(errorData.message || 'Forgot Password failed');
            if (errorData.redirectUrl) {
              setTimeout(() => {
                navigate(errorData.redirectUrl);
              }, 2000);
            }
          } else {
            toast.error('An unexpected error occurred');
          }
        } finally {
          setLoading(false); 
        }
      }
    },
  });

  return (
    <div className="w-full h-screen flex bg-secondary-600 text-gray-300 ">
      <div className=" relative w-[55%] lg:w-[62%]">
        <img src={logo} className="absolute w-32 h-auto ml-8 mt-8" alt="logo" />
        <div className="relative w-full h-screen flex">
          <img src={bgBase} className="absolute bottom-0 left-0 w-full h-1/3" alt="Surface-image" />
          <img
            src={bgImage}
            className="relative bg-no-repeat bg-fixed bg-center bg-cover w-2/3 ml-[25%] my-auto"
            alt="Background-image"
          />
        </div>
      </div>
      <div className=" flex relative w-[45%] lg:w-[38%] h-screen bg-secondary-500 ">
        <div className="p-10 relative my-auto">
          <div>
            <h2 className="text-2xl font-bold text-left">Forgot Password 🔒</h2>
            <p className="text-sm text-left mt-2 text-gray-400">
              {' Enter your email and we ll send you instructions to reset your password'}
            </p>
          </div>
          <form className="space-y-4" onSubmit={formik.handleSubmit}>
            <div className="mt-5">
              <label
                htmlFor="email"
                className={`block mb-1 text-sm font-medium focus:ring-blue-600 ${
                  formik.touched.email && formik.errors.email
                    ? 'text-red-500'
                    : isEmailFocused
                    ? 'text-blue-500'
                    : 'text-gray-300'
                }`}
              >
                Email
              </label>
              <div>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formik.values.email}
                  onChange={formik.handleChange}
                  onBlur={() => setIsEmailFocused(false)}
                  onFocus={() => setIsEmailFocused(true)}
                  className={`text-gray-200 w-full border-gray-500 outline-none hover:border-gray-300 rounded-md bg-transparent py-1.5 pl-1 placeholder:text-gray-400 sm:text-sm sm:leading-6 ${
                    formik.touched.email && formik.errors.email
                      ? 'border-none outline-1 outline-red-500'
                      : ''
                  }`}
                  placeholder="Enter your email or username"
                />
              </div>
              {formik.touched.email && formik.errors.email ? (
                <div className="text-red-500 text-sm mt-1">{formik.errors.email}</div>
              ) : null}
            </div>
            <button
              type="submit"
              className="w-full py-1 px-4 bg-blue-500 text-gray-200 font-semibold rounded-md active:bg-indigo-400 transition duration-100 active:translate-y-1"
            >
              {loading ? 'Processing...' : 'Send Reset Link'}
            </button>
          </form>
          <div className="flex gap-1 justify-center text-blue-500 items-center mt-5 font-bold">
            <Link to="/" className="flex items-center gap-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth="1.5"
                stroke="currentColor"
                className="size-5 text-textColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 19.5 8.25 12l7.5-7.5"
                />
              </svg>
              <p className="text-sm">Back to Login</p>
            </Link>
          </div>
        </div>
      </div>
      <ToastContainer />
    </div>
  );
}
