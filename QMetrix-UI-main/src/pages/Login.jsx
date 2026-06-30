import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useFormik } from 'formik';
import { object, string } from 'yup';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import { useDispatch, useSelector } from 'react-redux';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import GoogleButton from 'react-google-button';
import bgImage from '../assets/images/bgImg1.png';
import bgBase from '../assets/images/bgBase.png';
import { addLogin, updateLoading } from '../store/authentication/loginSlice';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { login, getProjectList } from '../constants';
import {
  setProjectList,
  setSelectedOrganization,
  setOrganizationList,
  setSprintList,
  setReleasesList,
  setRepoList,
  setBoardList,
  setSelectedProject,
} from '../store/JiraSlices/jiraSlice';
import { storeBoardInSession } from '../utils/boardUtils';
export default function SignIn() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const { loading } = useSelector((state) => state.login || {});
  const [initialLoginValues] = useState({ email: '', password: '' });
  const [isEmailFocused, setIsEmailFocused] = useState(false);
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const validationSchema = object({
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
  });

  const location = useLocation();

  useEffect(() => {
    const fetchData = async () => {
      const params = new URLSearchParams(location.search);
      const token = params.get('token');
      const companyId = params.get('companyId');
      const username = params.get('username');
      const useremail = params.get('useremail');

      const data = {
        name: username,
        email: useremail,
      };


      if (token && companyId) {
        sessionStorage.setItem('qmetrix-token', token);
        sessionStorage.setItem('companyId', companyId);
        sessionStorage.setItem('syncStatus', 'success');
        sessionStorage.setItem('userData', JSON.stringify(data));

        navigate('/dashboard');
      }
    };

    fetchData();
  }, [location]);

  useEffect(() => {
    dispatch(updateLoading());
  }, [dispatch]);
  const mutateAsync = useMutation({
    mutationFn: login,
    onSuccess: async (data) => {
      const token = data?.data?.token;
      const companyId = data?.data?.companyId;

      queryClient.invalidateQueries(['addLogin']);
      sessionStorage.setItem('qmetrix-token', token);
      sessionStorage.setItem('companyId', companyId);
      sessionStorage.setItem('syncStatus', 'success');
      const navData = data?.data?.navigationData;
      const companyName = navData?.companyName || 'Trigent';

      dispatch(
        setSelectedOrganization({
          selectedOrgName: companyName,
          selectedOrgId: companyId,
        }),
      );
      sessionStorage.setItem('orgId', companyId);
      sessionStorage.setItem('orgName', companyName);

      if (navData?.status === 'success') {
        dispatch(setProjectList(navData.projectList));

        if (navData.allOrgs?.length > 0) {
          dispatch(setOrganizationList(navData.allOrgs));
          queryClient.setQueryDefaults(['getAllOrgsListAPI'], { staleTime: 30 * 60 * 1000 });
          queryClient.setQueryData(['getAllOrgsListAPI'], navData.allOrgs);
        }

        const dp = navData.defaultProject;
        if (dp) {
          sessionStorage.setItem('projectId', dp.projectId);
          sessionStorage.setItem('projectName', dp.projectName);
          dispatch(setSelectedProject({
            selectedProjectName: dp.projectName,
            selectedProjectId: dp.projectId,
          }));

          if (dp.boardList?.length > 0) {
            dispatch(setBoardList(dp.boardList));
          }

          if (dp.lastSynced != null) {
            const syncKey = `syncStatus_${companyId}_${dp.projectId}`;
            const timeKey = `lastSyncTime_${companyId}_${dp.projectId}`;
            sessionStorage.setItem(timeKey, dp.lastSynced);
            sessionStorage.setItem(syncKey, dp.syncStatus ? 'success' : 'failed');
          }

          const db = dp.defaultBoard;
          if (db) {
            storeBoardInSession(db.boardId, db.boardName, db.boardType || '');

            dispatch(setSprintList(db.sprintList || []));
            dispatch(setReleasesList(db.releaseList || []));
            dispatch(setRepoList(db.repoList || []));
          }
        }
      } else {
        if (navData?.error) {
          toast.warn(`Navigation data: ${navData.error}`, {
            className: 'bg-secondary-500 text-white',
          });
        }
        try {
          const projectList = await getProjectList(companyId);
          dispatch(setProjectList(projectList.data));
        } catch (error) {
          console.error('Failed to fetch project list:', error);
        }
      }

      dispatch(addLogin(data));

      const hasProjects = navData?.projectList?.length > 0;

      if (data.success === true) {
        toast.success(data.message, {
          className: 'bg-secondary-500 text-white',
        });
        setTimeout(() => {
          navigate(hasProjects ? data.redirectUrl : '/integration');
        }, 1000);
      } else {
        navigate(hasProjects ? '/dashboard' : '/integration');
      }
    },
    onError: (error) => {
      if (
        (error.response?.status === 401 || error.response?.status === 404) &&
        error.response?.data?.success === false
      ) {
        toast.info(error.response?.data?.message, {
          className: 'bg-secondary-500 text-white',
        });
        setTimeout(() => {
          navigate(error.response?.data?.redirectUrl);
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

  const googleSignIn = () => {
    const googleLoginURL = `/api/user/auth/google`;
    window.location.href = googleLoginURL;
  };
  const handleNavigate = () => {
    dispatch(updateLoading());
    navigate('/register');
  };

  return (
    <div className="bg-secondary-600 flex flex-row w-full overflow-hidden">
      <div className="relative md:w-[55%] lg:w-[62%]">
        <div className="relative h-screen flex">
          <img src={bgBase} className="fixed bottom-0 left-0 w-full h-1/3" alt="Surface-image" />
          <img
            src={bgImage}
            className="relative bg-no-repeat bg-fixed bg-center bg-cover w-2/3 ml-[25%] my-auto"
            alt="Background-image"
          />
        </div>
      </div>
      <div className="bg-secondary-500 w-[45%] lg:w-[38%] h-screen relative flex">
        <div className="relative my-auto w-4/5 ml-[10%]">
          <div className="flex flex-col relative w-full mb-4">
            <h1 className="text-2xl font-semibold text-gray-300 flex items-center">
              Welcome to QMetry ! 👋🏻
            </h1>
            <h1 className="text-base text-gray-400">
              Please sign-in to your account and start the adventure
            </h1>
          </div>
          <div className="relative">
            <form onSubmit={formik.handleSubmit}>
              <div className="sm:col-span-4 w-full">
                <label
                  htmlFor="email"
                  className={`block text-sm mb-2 font-medium leading-6 ${formik.touched.email && formik.errors.email
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
                    className={`text-gray-200 w-full border-gray-500 outline-none hover:border-gray-300 rounded-md bg-transparent py-1.5 pl-1 placeholder:text-gray-400 sm:text-sm sm:leading-6 ${formik.touched.email && formik.errors.email
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
              <div className="sm:col-span-4 w-full mt-6">
                <label
                  htmlFor="password"
                  className={`block text-sm mb-2 font-medium leading-6 ${formik.touched.password && formik.errors.password
                      ? 'text-red-500'
                      : isPasswordFocused
                        ? 'text-blue-500'
                        : 'text-gray-300'
                    }`}
                >
                  Password
                </label>
                <div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    id="password"
                    value={formik.values.password}
                    onChange={formik.handleChange}
                    onBlur={() => setIsPasswordFocused(false)}
                    onFocus={() => setIsPasswordFocused(true)}
                    className={`text-gray-200 w-full border-gray-500 outline-none hover:border-gray-300 rounded-md bg-transparent py-1.5 pl-1 placeholder:text-gray-400 sm:text-sm sm:leading-6 ${formik.touched.password && formik.errors.password
                        ? ' border-none outline-1 outline-red-500'
                        : ''
                      }`}
                    placeholder="********"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute mx-auto mt-5 text-blue-500 opacity-75 right-[1%] pr-3 bg-transparent transform -translate-y-1/2 focus:outline-none"
                  >
                    {showPassword ? <FaEyeSlash size={20} /> : <FaEye size={20} />}
                  </button>
                </div>
                {formik.touched.password && formik.errors.password ? (
                  <div className="text-red-500 text-sm mt-1">{formik.errors.password}</div>
                ) : null}
              </div>
              <div className=" mt-6 mb-4 flex flex-row items-center justify-between w-full">
                <span className="text-gray-300">
                  <input
                    type="checkbox"
                    className="appearance-none mr-2 bg-transparent rounded-md border-gray-400 hover:border-gray-300 cursor-pointer"
                  />
                  Remember me
                </span>
                <Link to="/forgotPassword">
                  <span className="block text-blue-500 font-normal cursor-pointer">
                    Forgot Password ?
                  </span>
                </Link>
              </div>
              <button
                type="submit"
                className={`w-full p-2 rounded-md bg-blue-500 text-white font-semibold hover:bg-blue-600 transition duration-300 ${loading ? 'opacity-50 cursor-not-allowed' : ''
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
                  'Login'
                )}
              </button>
            </form>
          </div>

          {process.env.REACT_APP_ENV === 'production' && (
            <>
              <div className="flex w-1/2 mx-auto justify-evenly text-xl mt-2">
                <div className="hover:bg-gray-600 cursor-pointer mt-5">
                  <GoogleButton
                    style={{
                      borderRadius: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      paddingLeft: '10px',
                      paddingRight: '0px',
                    }}
                    onClick={googleSignIn}
                  />
                </div>
              </div>
            </>
          )}

          <div className="relative mt-5 flex justify-center items-center gap-0.5">
            <span className="text-gray-300 lg:mr-2">New to our platform? </span>
            <Link onClick={handleNavigate}>
              <span className="text-blue-500 font-normal cursor-pointer">Create an Account</span>
            </Link>
          </div>
        </div>
      </div>
      <ToastContainer />
    </div>
  );
}
