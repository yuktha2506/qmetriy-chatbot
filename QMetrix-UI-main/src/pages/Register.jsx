import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFormik } from 'formik';
import { object, string, ref } from 'yup';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { useDispatch, useSelector } from 'react-redux';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import bgImage from '../assets/images/bgImg2.png';
import bgBase from '../assets/images/bgBase.png';
import logo from '../assets/images/logo.png';
import { addRegister, updateRegisterLoading } from '../store/authentication/registerSlice';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getId, userRegister } from '../constants';

export default function SignUp() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const companyName = getId().companyName;
  const { loading } = useSelector((state) => state.register || {});
  const [initialLoginValues] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    companyName: companyName,
    role: 'Admin',
  });
  const [isUsernameFocused, setIsUsernameFocused] = useState(false);
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isConfirmPasswordFocused, setIsConfirmPasswordFocused] = useState(false);

  const validationSchema = object({
    name: string()
      .required('Username is required')
      .min(3, 'Username must contain at least 3 letter'),
    email: string()
      .email('Invalid email address')
      .required('Email is required')
      .test('domain', 'Invalid email address', (value) => {
        if (!value) return false;
        const domainPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+\.com$/;
        return domainPattern.test(value);
      }),
    password: string()
      .required('Password is required')
      .min(8, 'Password must be at least 8 characters')
      .matches(
        /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])(?=.*[!@#$%^&*()_+}{"':;?/>.<,]).*$/,
        'Password must contain at least:\nOne Uppercase letter\nOne Lowercase letter\nOne Number\nOne Special character',
      ),
    confirmPassword: string()
      .oneOf([ref('password'), null], 'Passwords must match')
      .required('Confirm Password is required'),
  });
  useEffect(() => {
    dispatch(updateRegisterLoading());
  }, [dispatch]);

  const mutateAsync = useMutation({
    mutationFn: userRegister,
    onSuccess: (data) => {
      queryClient.invalidateQueries(['register']);
      dispatch(addRegister(data));
      if (data.status === 200) {
        toast.info(data?.data.message, {
          className: 'bg-secondary-500 text-white',
        });
        setTimeout(() => {
          navigate('/');
        }, 1000);
        dispatch(updateRegisterLoading());
      } else if (data.status === 201) {
        toast.success('User Registered Successfully', {
          className: 'bg-secondary-500 text-white',
        });
        setTimeout(() => {
          navigate('/');
        }, 1000);
      }
    },
    onError: (error) => {
      if (error?.response?.status === 401 || error?.response?.status === 404) {
        toast.info(error?.response?.data?.error, {
          className: 'bg-secondary-500 text-white',
        });
        setTimeout(() => {
          navigate(error?.response?.data?.redirectUrl);
        }, 1000);
      }
    },
  });
  const formik = useFormik({
    initialValues: initialLoginValues,
    enableReinitialize: true,
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      const payload = {
        ...values,
        email: values.email.toLowerCase(),
      };
      try {
        mutateAsync.mutate(payload);
      } catch (error) {
        toast.error(error);
      }
    },
  });

  return (
    <div className="bg-secondary-600 flex flex-row w-full overflow-y-hidden">
      <div className="relative w-[55%] lg:w-[62%]">
        <img src={logo} className="absolute mt-8 ml-8 w-32 z-10" alt="logo" />
        <div className="relative h-screen flex">
          <img src={bgBase} className="fixed bottom-0 left-0 w-full h-1/3" alt="Surface-image" />
          <img
            src={bgImage}
            className="relative bg-no-repeat bg-fixed bg-center bg-cover w-2/3 ml-[20%] my-auto"
            alt="Background-image"
          />
        </div>
      </div>
      <div className="bg-bgColor w-[45%] lg:w-[38%] relative flex">
        <div className="relative mt-5 ml-[10%] mb-10 w-4/5">
          <div className="flex flex-col relative">
            <h1 className="text-2xl font-semibold text-gray-300 flex items-center">
              Adventure start here ! 🚀
            </h1>
            <h1 className="text-base mt-1 text-gray-400">Make your app management easy and fun!</h1>
          </div>
          <div className="relative mt-5">
            <form onSubmit={formik.handleSubmit}>
              <div className=" relative w-full">
                <label
                  htmlFor="name"
                  className={`block text-sm mb-1 leading-6 ${
                    formik.touched.name && formik.errors.name
                      ? 'text-red-500'
                      : isUsernameFocused
                      ? 'text-blue-500'
                      : 'text-gray-300'
                  }`}
                >
                  Username
                </label>
                <div>
                  <input
                    type="text"
                    name="name"
                    id="name"
                    value={formik.values.name}
                    onChange={formik.handleChange}
                    onBlur={() => setIsUsernameFocused(false)}
                    onFocus={() => setIsUsernameFocused(true)}
                    className={`text-gray-200 w-full border-gray-500 outline-none hover:border-gray-300 rounded-md bg-transparent py-1.5 pl-1 placeholder:text-gray-400 sm:text-sm sm:leading-6 ${
                      formik.touched.email && formik.errors.email
                        ? 'border-none outline-1 outline-red-500'
                        : ''
                    }`}
                    placeholder="Username"
                  />
                </div>
                {formik.touched.name && formik.errors.name ? (
                  <div className="text-red-500 text-sm mt-1">{formik.errors.name}</div>
                ) : null}
              </div>
              <div className="col-span-4 w-full mt-4">
                <label
                  htmlFor="email"
                  className={`block text-sm mb-1 font-medium leading-6 ${
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
                    name="email"
                    id="email"
                    value={formik.values.email}
                    onChange={formik.handleChange}
                    onBlur={() => setIsEmailFocused(false)}
                    onFocus={() => setIsEmailFocused(true)}
                    className={`text-gray-200 w-full border-gray-500 outline-none hover:border-gray-300 rounded-md bg-transparent py-1.5 pl-1 placeholder:text-gray-400 sm:text-sm sm:leading-6 ${
                      formik.touched.email && formik.errors.email
                        ? 'border-none outline-1 outline-red-500'
                        : ''
                    }`}
                    placeholder="Email Address"
                  />
                </div>
                {formik.touched.email && formik.errors.email ? (
                  <div className="text-red-500 text-sm mt-1">{formik.errors.email}</div>
                ) : null}
              </div>
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
                  Password
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
                  Confirm Password
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
              <div className=" mt-6 mb-4 flex flex-row items-center w-4/5">
                <span className="text-gray-300">
                  <input
                    type="checkbox"
                    className="appearance-none focus:outline-none focus:ring-0 focus:ring-transparent required:border-red-500 mr-2 checked:bg-indigo-300 bg-transparent rounded-md border-gray-700 border-custom cursor-pointer"
                  />
                  I agree to
                </span>
                <span className="block text-blue-500 font-normal cursor-pointer ml-2">
                  Privacy policy and terms
                </span>
              </div>
              <button
                type="submit"
                className={`w-full p-2 rounded-md bg-blue-500 text-white font-semibold hover:bg-blue-600 transition duration-300 ${
                  loading ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <svg
                      className="animate-spin h-5 w-5 text-white mr-2"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M12 4.75v1.5M6.343 6.343l1.06 1.06M4.75 12h1.5M6.343 17.657l1.06-1.06M12 18.25v1.5M17.657 17.657l-1.06-1.06M18.25 12h-1.5M17.657 6.343l-1.06 1.06"
                      />
                    </svg>
                    Processing...
                  </div>
                ) : (
                  'Register'
                )}
              </button>
            </form>
          </div>
          <div className="flex items-center justify-evenly font-medium text-lg text-gray-400">
            <hr className="w-[35%] border-gray-500" />
            <p>or</p>
            <hr className="w-[35%] border-gray-500" />
          </div>
          <div className="relative flex justify-center items-center gap-3">
            <span className="text-gray-300">Already have an account? </span>
            <Link to="/">
              <span className="text-blue-500 font-normal cursor-pointer">Sign In instead</span>
            </Link>
          </div>
        </div>
      </div>
      <ToastContainer />
    </div>
  );
}
