import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useFormik } from 'formik';
import { object, string } from 'yup';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { addCompany, updateAddCompanyLoading } from '../store/authentication/addCompanySlice';
import { addCompanyOrg } from '../constants';

export default function AddCompany() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { loading } = useSelector((state) => state.addCompany);

  const [initialValues] = useState({
    host: '',
    companyName: '',
  });

  const validationSchema = object({
    companyName: string().required('Organization Name is required'),
  });
  useEffect(() => {
    dispatch(updateAddCompanyLoading());
  }, [dispatch]);

  const mutateAsync = useMutation({
    mutationFn: addCompanyOrg,
    onSuccess: (data) => {
      queryClient.invalidateQueries(['addCompany']);
      sessionStorage.setItem('companyId', data._id);
      sessionStorage.setItem('companyName', data.companyName);
      dispatch(addCompany(data));
      toast.success('Company Added successfully!', {
        className: 'bg-secondary-500 text-white',
      });
      setTimeout(() => {
        navigate('/register');
      }, 1000);
    },
    onError: (error) => {
      if (error.response?.status === 400) {
        toast.info(error.response?.data?.message, {
          className: 'bg-secondary-500 text-white',
        });
        setTimeout(() => {
          navigate('/');
        }, 1000);
      }
    },
  });

  const formik = useFormik({
    initialValues: initialValues,
    enableReinitialize: true,
    validationSchema: validationSchema,
    onSubmit: async (values) => {
      values.host = `${values.companyName}.com`;
      const [firstPart, secondPart] = values.host.split('.');
      const capitalizedOrganizationName =
        firstPart.charAt(0).toUpperCase() + firstPart.slice(1) + '.' + secondPart;
      values.host = capitalizedOrganizationName;
      try {
        mutateAsync.mutate(values);
      } catch (error) {
        console.error(error);
      }
    },
  });

  return (
    <div className="flex justify-center p-8 items-center min-h-screen bg-body">
      <div className="w-full max-w-lg">
        <h2 className="text-2xl font-semibold text-center text-white mb-6">
          Add your organization under QMetrix
        </h2>
        <form onSubmit={formik.handleSubmit} className="px-8">
          <div className="mb-6">
            <label className="block mb-2 text-sm font-medium text-gray-400">
              {"What is your organization's name?"}
            </label>
            <input
              type="companyName"
              name="companyName"
              className="w-full px-4 py-2 text-sm text-gray-300 bg-transparent border border-gray-600 rounded-lg"
              placeholder="Enter Name"
              value={formik.values.companyName}
              onChange={formik.handleChange}
            />
            {formik.touched.companyName && formik.errors.companyName ? (
              <div className="text-red-500 text-sm mt-1">{formik.errors.companyName}</div>
            ) : null}
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
              'Add Company'
            )}
          </button>
        </form>
      </div>
      <ToastContainer />
    </div>
  );
}
