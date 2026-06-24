import PropTypes from 'prop-types';
import classNames from 'classnames';

const FormInput = ({
  type = 'text',
  field,
  form: { touched, errors },
  variant = 'primary',
  className,
  placeholder,
  ...props
}) => {
  const baseClasses =
    'w-[400px] mt-2 focus:ring-2 focus:outline-none font-medium rounded-md text-sm px-5 py-2';

  const variantClasses = {
    primary:
      'bg-white text-black dark:text-custom-gray  focus:ring-blue-300  dark:bg-bgColor dark:focus:ring-blue-800',
    secondary:
      'w-full mt-0 border-blck bg-transparent text-black dark:text-white placeholder-gray-400 py-2 px-4 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500',
  };

  return (
    <div>
      <input
        type={type}
        {...field}
        className={classNames(baseClasses, variantClasses[variant], className)}
        placeholder={placeholder}
        {...props}
      />
      {touched[field.name] && errors[field.name] ? (
        <div className="text-red-500 text-sm mt-1">{errors[field.name]}</div>
      ) : null}
    </div>
  );
};

FormInput.propTypes = {
  field: PropTypes.object.isRequired,
  form: PropTypes.shape({
    touched: PropTypes.object,
    errors: PropTypes.object,
  }).isRequired,
  type: PropTypes.oneOf(['text', 'email', 'password', 'number']),
  variant: PropTypes.oneOf(['primary', 'secondary']),
  className: PropTypes.string,
  placeholder: PropTypes.string,
};

export default FormInput;
