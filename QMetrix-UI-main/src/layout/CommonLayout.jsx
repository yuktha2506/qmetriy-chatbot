
import PropTypes from 'prop-types';
import Header from './Header';
import Sidebar from './Sidebar';

function CommonLayout({ children }) {
  return (
    <div className="flex">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1">
          {typeof children === 'function' ? children(false) : children}
        </main>
      </div>
    </div>


  );
}

CommonLayout.propTypes = {
  children: PropTypes.any,
};

export default CommonLayout;
