import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useFormik } from 'formik';
import { object, string, ref } from 'yup';
import { toast, ToastContainer } from 'react-toastify';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import bgImage from '../assets/images/bgImg3.png';
import bgBase from '../assets/images/bgBase.png';
import logo from '../assets/images/logo.png';
import { userResetPassword } from '../constants';

export default function ResetPassword() {
  const navigate = useNavigate();
  const { token } = useParams();
  const [initialLoginValues] = useState({
    password: '',
  });

  const validationSchema = object({
    password: string()
      .required('Password is required')
      .min(8, 'Password must be at least 8 characters')
      .matches(
        /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+}{"':?/>.<,]).*$/,
        'Password must contain at least:\nOne Uppercase letter\nOne Lowercase letter\nOne Number\nOne Special character',
      ),
    confirmPassword: string()
      .oneOf([ref('password'), null], 'Passwords must match')
      .required('Confirm Password is required'),
  });

  const [showPassword, setShowPassword] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isConfirmPasswordFocused, setIsConfirmPasswordFocused] = useState(false);

  const formik = useFormik({
    initialValues: initialLoginValues,
    enableReinitialize: true,
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      if (values.password !== '' && values.password === values.confirmPassword) {
        try {
          const response = await userResetPassword(token, values.password);
          const dataApi = response.data;
          if (dataApi.success) {
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
        } catch (error) {
          if (error.response && error.response.data) {
            const errorData = error.response.data;
            toast.error(errorData.message || 'Password reset failed');
            if (errorData.redirectUrl) {
              setTimeout(() => {
                navigate(errorData.redirectUrl);
              }, 2000);
            }
          } else {
            toast.error('An unexpected error occurred');
          }
        }
      } else {
        toast.error('Passwords do not match');
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
        <div className="relative w-full sm:w-4/5 p-5 sm:p-0 sm:mx-[10%] my-auto">
          <div className="flex flex-col relative">
            <h2 className="text-2xl font-bold text-left">Welcome to Reset Password Page! 👋🏻</h2>
            <p className="text-sm text-left mt-2 text-gray-400">Please enter your new password</p>
          </div>
          <div className="relative mt-8 sm:mt-4">
            <form onSubmit={formik.handleSubmit}>
              <div className="mb-4 mt-3">
                <label
                  htmlFor="password"
                  className={`block text-sm mb-1 font-medium leading-6 ${
                    formik.touched.password && formik.errors.password
                      ? 'text-red-500'
                      : isPasswordFocused
                      ? 'text-blue-500'
                      : 'text-gray-300'
                  }`}
                >
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    id="password"
                    value={formik.values.password}
                    onChange={formik.handleChange}
                    onBlur={() => setIsPasswordFocused(false)}
                    onFocus={() => setIsPasswordFocused(true)}
                    className={`text-gray-200 w-full border-gray-500 outline-none hover:border-gray-300 rounded-md bg-transparent py-1.5 pl-1 placeholder:text-gray-400 sm:text-sm sm:leading-6 ${
                      formik.touched.password && formik.errors.password
                        ? 'border-none outline-1 outline-red-500'
                        : ''
                    }`}
                    placeholder="********"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute mt-5 text-blue-500 opacity-75 right-[1%] pr-3 bg-transparent transform -translate-y-1/2 focus:outline-none"
                  >
                    {showPassword ? <FaEyeSlash size={20} /> : <FaEye size={20} />}
                  </button>
                </div>
                {formik.touched.password && formik.errors.password ? (
                  <div className="text-red-500 text-sm mt-1">{formik.errors.password}</div>
                ) : null}
              </div>
              <div className="mb-4">
                <label
                  htmlFor="confirmPassword"
                  className={`block text-sm mb-1 font-medium leading-6 ${
                    formik.touched.confirmPassword && formik.errors.confirmPassword
                      ? 'text-red-500'
                      : isConfirmPasswordFocused
                      ? 'text-blue-500'
                      : 'text-gray-300'
                  }`}
                >
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    id="confirmPassword"
                    value={formik.values.confirmPassword}
                    onChange={formik.handleChange}
                    onBlur={() => setIsConfirmPasswordFocused(false)}
                    onFocus={() => setIsConfirmPasswordFocused(true)}
                    className={`text-gray-200 w-full border-gray-500 outline-none hover:border-gray-300 rounded-md bg-transparent py-1.5 pl-1 placeholder:text-gray-400 sm:text-sm sm:leading-6 ${
                      formik.touched.confirmPassword && formik.errors.confirmPassword
                        ? 'border-none outline-1 outline-red-500'
                        : ''
                    }`}
                    placeholder="********"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    className="absolute mt-5 text-blue-500 opacity-75 right-[1%] pr-3 bg-transparent transform -translate-y-1/2 focus:outline-none"
                  >
                    {showConfirmPassword ? <FaEyeSlash size={20} /> : <FaEye size={20} />}
                  </button>
                </div>
                {formik.touched.confirmPassword && formik.errors.confirmPassword ? (
                  <div className="text-red-500 text-sm mt-1">{formik.errors.confirmPassword}</div>
                ) : null}
              </div>
              <button
                type="submit"
                className="w-full py-1 px-4 bg-blue-500 text-gray-200 font-semibold rounded-md active:bg-indigo-400 transition duration-100 active:translate-y-1"
              >
                Reset
              </button>
            </form>
            <div className="flex gap-1 justify-center items-center mt-5 font-bold text-blue-500">
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
                <p className="text-sm">Back to Login Page</p>
              </Link>
            </div>
          </div>
        </div>
      </div>
      <ToastContainer />
    </div>
  );
}
